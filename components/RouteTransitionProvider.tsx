"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useSceneStore } from "@/lib/store";
import { routeFromPathname, routeColor, titleFor, type RouteDescriptor } from "@/lib/route";
import { moveCamera, snapOrEaseCamera } from "@/lib/camera-math";
import { setLight } from "@/three/postApi";
import { openStone, closeStone } from "@/three/stoneCrack";
import { getProjectTexture } from "@/three/textures";
import { projects } from "@/content/projects";
import { animateOut, prepareView, enterView, resplit } from "@/lib/text-reveal";
import { resetScrollPosition, resizeScroll, initScroll } from "@/lib/scroll";
import { usePointer } from "@/hooks/usePointer";
import { RETURN_HOME_DURATION } from "@/lib/timing";

interface Displayed {
  pathname: string;
  children: ReactNode;
}

// All route changes go through here: camera, light color, hide the old view, swap, show the new
// one. Based on usePathname() so back/forward and fast clicks work the same way.
export function RouteTransitionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [displayed, setDisplayed] = useState<Displayed>({ pathname, children });
  const containerRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const busyRef = useRef(true); // false once the intro is done
  const pendingRef = useRef<Displayed | null>(null);
  const mountPrepped = useRef(false);
  const introFired = useRef(false);
  const booted = useSceneStore((s) => s.booted);
  const probed = useSceneStore((s) => s.probed);

  usePointer();

  useEffect(() => {
    if (!probed) return;
    initScroll(useSceneStore.getState().reducedMotion);
  }, [probed]);

  function currentView(): HTMLElement | null {
    return (containerRef.current?.firstElementChild as HTMLElement | null) ?? null;
  }

  function visualHandler(route: RouteDescriptor) {
    return (el: HTMLElement) => {
      if (route.name !== "project") return;
      if (!containerRef.current?.contains(el)) return; // old transition
      const project = projects[route.index];
      const { reducedMotion } = useSceneStore.getState();
      // keep the stone open with the photo while on a project page
      openStone(getProjectTexture(project, route.index), route.index, reducedMotion, true);
    };
  }

  function drainPending() {
    if (!pendingRef.current) return;
    const next = pendingRef.current;
    pendingRef.current = null;
    runTransition(next);
  }

  function runTransition(next: Displayed) {
    busyRef.current = true;
    const { reducedMotion, hasWebGL } = useSceneStore.getState();
    const route = routeFromPathname(next.pathname);
    const fromRoute = routeFromPathname(displayed.pathname);

    // Don't close it for another project (crossfade) or going home (the cursor is usually still
    // on the item, HomeView handles it). Closing here flickers.
    if (route.name === "about") closeStone(reducedMotion);
    // open the stone right on click, with the camera move (the later call does nothing)
    if (route.name === "project") {
      openStone(getProjectTexture(projects[route.index], route.index), route.index, reducedMotion, true);
    }
    // going home: camera takes as long as the stone closing
    const cameraDuration = fromRoute.name === "project" && route.name === "home" ? RETURN_HOME_DURATION : undefined;
    moveCamera(route, false, reducedMotion, cameraDuration);
    setLight(routeColor(route));
    useSceneStore.getState().setHeaderLabel(route.name === "about" ? "Index" : "About");

    const afterOut = () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      resetScrollPosition();
      document.title = titleFor(route);
      // hide right away, the rAF below lands a frame late and the new view flashes
      if (containerRef.current) containerRef.current.style.visibility = "hidden";
      setDisplayed(next);

      requestAnimationFrame(() => {
        const view = currentView();
        if (!view) {
          if (containerRef.current) containerRef.current.style.visibility = "";
          busyRef.current = false;
          drainPending();
          return;
        }
        prepareView(view, reducedMotion, hasWebGL);
        if (containerRef.current) containerRef.current.style.visibility = "";
        resizeScroll();
        view.focus({ preventScroll: true });
        window.setTimeout(
          () => {
            observerRef.current = enterView(view, reducedMotion, hasWebGL, visualHandler(route));
            busyRef.current = false;
            drainPending();
          },
          reducedMotion ? 50 : 350
        );
      });
    };

    const outgoing = currentView();
    if (outgoing) {
      animateOut(outgoing, reducedMotion, hasWebGL).then(afterOut);
    } else {
      afterOut();
    }
  }

  // set header label and title before the loader goes away
  useEffect(() => {
    if (mountPrepped.current) return;
    mountPrepped.current = true;
    const route = routeFromPathname(pathname);
    useSceneStore.getState().setHeaderLabel(route.name === "about" ? "Index" : "About");
    document.title = titleFor(route);
    const view = currentView();
    if (view) {
      const { reducedMotion, hasWebGL } = useSceneStore.getState();
      prepareView(view, reducedMotion, hasWebGL);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // intro, once the loader is done
  useEffect(() => {
    if (!booted || introFired.current) return;
    introFired.current = true;
    const { reducedMotion, hasWebGL } = useSceneStore.getState();
    const route = routeFromPathname(displayed.pathname);

    moveCamera(route, true, reducedMotion);
    setLight(routeColor(route));

    const view = currentView();
    resizeScroll();
    window.setTimeout(
      () => {
        if (view) observerRef.current = enterView(view, reducedMotion, hasWebGL, visualHandler(route));
        busyRef.current = false;
        drainPending();
      },
      900
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted]);

  // navigation (same pathname = nothing to do)
  useEffect(() => {
    if (pathname === displayed.pathname) return;
    const next: Displayed = { pathname, children };
    if (busyRef.current) {
      pendingRef.current = next;
      return;
    }
    runTransition(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, children]);

  const renderedChildren = pathname === displayed.pathname ? children : displayed.children;

  // resize: re-split the text and move the camera
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastW = window.innerWidth;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (window.innerWidth === lastW) return;
        lastW = window.innerWidth;
        const { reducedMotion } = useSceneStore.getState();
        resplit(currentView(), reducedMotion);
        const route = routeFromPathname(displayed.pathname);
        snapOrEaseCamera(route, reducedMotion);
      }, 180);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(timer);
    };
  }, [displayed.pathname]);

  return (
    <main id="app" ref={containerRef}>
      {renderedChildren}
    </main>
  );
}
