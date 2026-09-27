"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { site } from "@/content/site";
import { projects } from "@/content/projects";
import { pad } from "@/lib/format";
import { canHover } from "@/lib/device";
import { setLight } from "@/three/postApi";
import { openStone, closeStone } from "@/three/stoneCrack";
import { getProjectTexture } from "@/three/textures";
import { useSceneStore, frameState } from "@/lib/store";

export function HomeView() {
  const listRef = useRef<HTMLOListElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    const list = listRef.current;
    const items = itemRefs.current.filter((el): el is HTMLAnchorElement => !!el);
    if (!list) return;

    if (!canHover()) {
      list.classList.add("m");
      let active = -1;
      const updateActive = () => {
        const mid = window.innerHeight * 0.5;
        let best = -1;
        let bd = Infinity;
        items.forEach((el, i) => {
          const r = el.getBoundingClientRect();
          const d = Math.abs(r.top + r.height / 2 - mid);
          if (d < bd) {
            bd = d;
            best = i;
          }
        });
        if (best === active) return;
        active = best;
        items.forEach((el, i) => el.classList.toggle("is-active", i === best));
        const reduced = useSceneStore.getState().reducedMotion;
        if (best >= 0) {
          setLight(projects[best].color);
          openStone(getProjectTexture(projects[best], best), best, reduced);
        } else {
          closeStone(reduced);
        }
      };
      updateActive();
      window.addEventListener("scroll", updateActive, { passive: true });
      return () => window.removeEventListener("scroll", updateActive);
    }

    let hoverTimer: ReturnType<typeof setTimeout> | undefined;
    // ignore mouseleave for a bit after mount, the browser fires a fake one
    let settleUntil = 0;
    const enter = (i: number) => {
      clearTimeout(hoverTimer);
      list.classList.add("is-hover");
      items.forEach((a, k) => a.classList.toggle("is-active", k === i));
      setLight(projects[i].color);
      openStone(getProjectTexture(projects[i], i), i, useSceneStore.getState().reducedMotion);
    };
    const leave = () => {
      list.classList.remove("is-hover");
      items.forEach((a) => a.classList.remove("is-active"));
      setLight(site.homeColor);
      closeStone(useSceneStore.getState().reducedMotion);
    };
    const cleanups: (() => void)[] = [];
    items.forEach((a, i) => {
      const onEnter = () => enter(i);
      const onLeave = () => {
        if (performance.now() < settleUntil) return;
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(leave, 90);
      };
      a.addEventListener("mouseenter", onEnter);
      a.addEventListener("mouseleave", onLeave);
      a.addEventListener("focus", onEnter);
      a.addEventListener("blur", onLeave);
      cleanups.push(() => {
        a.removeEventListener("mouseenter", onEnter);
        a.removeEventListener("mouseleave", onLeave);
        a.removeEventListener("focus", onEnter);
        a.removeEventListener("blur", onLeave);
      });
    });
    // Coming back from a project the cursor is often still on the item, but no mouseenter fires.
    // So check the last pointer position right away.
    const el = document.elementFromPoint(frameState.pointer.x, frameState.pointer.y);
    const hit = el ? items.findIndex((a) => a.contains(el)) : -1;
    if (hit >= 0) {
      settleUntil = performance.now() + 400;
      enter(hit);
    } else {
      closeStone(useSceneStore.getState().reducedMotion);
    }
    return () => {
      clearTimeout(hoverTimer);
      cleanups.forEach((fn) => fn());
    };
  }, []);

  return (
    <section className="view home" tabIndex={-1}>
      <h1 className="sr">
        {site.name}, {site.role}
      </h1>
      {/* Static on purpose: the split/reveal animation sometimes left these hidden after a
          route change (see lib/text-reveal.ts). */}
      <ol className="plist" ref={listRef}>
        {projects.map((p, i) => (
          <li key={p.slug}>
            <Link
              className="p"
              href={`/work/${p.slug}`}
              data-i={i}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
            >
              <span className="p-num" aria-hidden="true">
                {pad(i + 1)}
              </span>
              <span className="p-title">{p.title}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
