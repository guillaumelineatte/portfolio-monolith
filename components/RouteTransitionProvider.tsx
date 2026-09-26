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

interface Displayed {
  pathname: string;
  children: ReactNode;
}

/**
 * Every route change goes through one queue: camera move, light color, mask out the old view,
 * swap the DOM, then reveal the new one. Based on the prototype's go(). Driven by
 * usePathname() so back/forward and fast clicks all take the same path.
 */
export function RouteTransitionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [displayed, setDisplayed] = useState<Displayed>({ pathname, children });
  const containerRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const busyRef = useRef(true); // released once the intro transition completes
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
      if (!containerRef.current?.contains(el)) return; // stale callback from a superseded transition
      const project = projects[route.index];
      const { reducedMotion } = useSceneStore.getState();
      // Keep the stone open with the photo inside while a project page is shown (same as the
      // home hover, just triggered by the route).
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

    // Don't close the stone when going to another project (it just crossfades), or when going
    // back home: the cursor is usually still over the clicked item and HomeView reopens it at
    // SPREAD_PREVIEW on mount, closing here would flicker. HomeView closes it itself if nothing
    // ends up hovered.
    if (route.name === "about") closeStone(reducedMotion);
    // Opening a project: burst the stone open right on click, alongside the camera move (both end
    // together), instead of waiting for the new page's visual to reveal ~1.4s later, which landed
    // the burst on the camera's peak speed. visualHandler's later call is then a no-op.
    if (route.name === "project") {
      openStone(getProjectTexture(projects[route.index], route.index), route.index, reducedMotion, true);
    }
    // Going back home, match the camera duration to the stone's slow retreat (driveSpread in
    // stoneCrack.ts) so both read as one move.
    const cameraDuration = fromRoute.name === "project" && route.name === "home" ? 6.5 : undefined;
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
      // afterOut runs inside GSAP's ticker, so the rAF below lands a frame late and the new view
      // flashes before prepareView hides it. Hide the container right away instead.
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

  // Once on mount, so the header label/title are right before the loader goes away.
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

  // Intro, once the loader is done (prototype's go(first, true)).
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

  // Actual navigation. If the pathname still matches, renderedChildren already follows
  // children (RSC refresh etc), nothing to do.
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

  // Resize: resplit wrapped text and re-target (not re-transition) the camera.
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
