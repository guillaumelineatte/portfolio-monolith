import gsap from "gsap";
import Lenis from "lenis";
import { frameState } from "./store";
import { damp } from "./math";

let lenis: Lenis | null = null;
let started = false;
let tickerBound = false;

export function getLenis(): Lenis | null {
  return lenis;
}

function tick(dt: number) {
  const sy = lenis ? lenis.scroll : window.scrollY;
  const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  frameState.scroll.progress = Math.min(1, Math.max(0, sy / max));
  if (dt > 0) {
    frameState.scroll.velocity = damp(frameState.scroll.velocity, (sy - frameState.scroll.lastY) / Math.max(dt, 1e-3), 8, dt);
  }
  frameState.scroll.lastY = sy;
}

/** Creates Lenis (unless reduced motion) and binds the scroll/velocity tick to gsap's ticker. Idempotent. */
export function initScroll(reducedMotion: boolean): void {
  if (tickerBound) return;
  tickerBound = true;

  if (!reducedMotion) {
    lenis = new Lenis({
      duration: 1.35,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.4,
    });
    lenis.stop();
  }

  gsap.ticker.add((time, deltaMs) => {
    if (lenis) lenis.raf(time * 1000);
    tick(Math.min(deltaMs / 1000, 0.1));
  });
  gsap.ticker.lagSmoothing(0);
}

/** Starts Lenis once the loader has finished (mirrors the prototype's start()). */
export function startScroll(): void {
  if (started) return;
  started = true;
  lenis?.start();
}

export function resetScrollPosition(): void {
  lenis?.scrollTo(0, { immediate: true, force: true });
  window.scrollTo(0, 0);
}

export function resizeScroll(): void {
  lenis?.resize();
}
