"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useSceneStore } from "@/lib/store";
import { projects } from "@/content/projects";
import { preloadProjectTexture } from "@/three/textures";
import { getCompile } from "@/three/postApi";
import { wait, nextFrame } from "@/lib/timing";
import { startScroll } from "@/lib/scroll";
import { inter, newsreader } from "@/app/fonts";

// Loader: fonts, visuals, gl, shaders, with a minimum duration. Then removes `is-loading`,
// starts Lenis and sets `booted`.
export function useBootSequence(): number {
  const [displayed, setDisplayed] = useState(0);
  const ranRef = useRef(false);

  useEffect(() => {
    // ref, not a cleanup flag, Strict Mode mounts twice
    if (ranRef.current) return;
    ranRef.current = true;

    const shown = { v: 0 };
    const prog = (p: number) => {
      gsap.to(shown, {
        v: p,
        duration: 0.9,
        ease: "expo.out",
        overwrite: true,
        onUpdate: () => setDisplayed(Math.round(shown.v)),
      });
    };

    (async () => {
      const t0 = performance.now();
      prog(6);

      try {
        if (document.fonts?.load) {
          const family = inter.style.fontFamily;
          await Promise.race([
            Promise.all([
              document.fonts.load(`300 64px ${family}`),
              document.fonts.load(`200 16px ${family}`),
              document.fonts.load(`400 16px ${family}`),
              document.fonts.load(`300 64px ${newsreader.style.fontFamily}`),
            ]).then(() => document.fonts.ready),
            wait(3000),
          ]);
        }
      } catch {
        // font probe failure shouldn't block the reveal
      }
      prog(22);
      await nextFrame();

      // 3 at a time, one by one was way too slow
      for (let i = 0; i < projects.length; i += 3) {
        const chunk = projects.slice(i, i + 3);
        await Promise.all(chunk.map((p, j) => preloadProjectTexture(p, i + j)));
        prog(22 + Math.round((Math.min(i + 3, projects.length) / projects.length) * 38));
        await nextFrame();
      }

      // CanvasRoot runs the WebGL probe in its own effect, wait for it.
      let probeTries = 0;
      while (!useSceneStore.getState().probed && probeTries < 120) {
        await nextFrame();
        probeTries++;
      }
      prog(72);
      await nextFrame();

      if (useSceneStore.getState().hasWebGL) {
        let tries = 0;
        while (!getCompile() && tries < 120) {
          await nextFrame();
          tries++;
        }
        getCompile()?.();
      }
      prog(90);
      await nextFrame();
      await nextFrame();
      prog(100);

      await wait(Math.max(1000, 1900 - (performance.now() - t0)));

      document.documentElement.classList.remove("is-loading");
      startScroll();
      useSceneStore.getState().setBooted(true);
    })();
  }, []);

  return displayed;
}
