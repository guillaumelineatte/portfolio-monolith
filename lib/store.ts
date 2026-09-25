import { create } from "zustand";

/**
 * Plain object written by GSAP tweens and read in useFrame. No React, so no re-renders.
 * Same role as `S.cam` / `S.img` / `S.scrollP` in the prototype.
 */
export const frameState = {
  cam: {
    pos: { x: 0.4, y: 1.75, z: 9.6 },
    target: { x: 0, y: 2.05, z: 0 },
  },
  pointer: { x: 0, y: 0, nx: 0, ny: 0 },
  scroll: { progress: 0, velocity: 0, lastY: 0 },
  img: {
    mode: "none" as "none" | "cursor" | "dom",
    el: null as HTMLElement | null,
    idx: -1,
    x: 0,
    y: 0,
    px: 0,
    py: 0,
    vx: 0,
    vy: 0,
    w: 300,
    h: 375,
  },
};

export type RouteName = "home" | "about" | "project";

interface SceneState {
  reducedMotion: boolean;
  hasWebGL: boolean;
  low: boolean;
  headerLabel: string;
  /** Whether the client-only capability probe (lib/device.ts, run once from CanvasRoot) has run. */
  probed: boolean;
  /** Whether the loader's boot sequence (hooks/useBootSequence.ts) has finished. */
  booted: boolean;
  setReducedMotion: (v: boolean) => void;
  setHasWebGL: (v: boolean) => void;
  setLow: (v: boolean) => void;
  setHeaderLabel: (v: string) => void;
  setProbed: (v: boolean) => void;
  setBooted: (v: boolean) => void;
}

/**
 * Zustand store for the reactive bits (header label, "Copied" live region, boot gating).
 * Non-React code uses useSceneStore.getState() so it never subscribes.
 */
export const useSceneStore = create<SceneState>((set) => ({
  reducedMotion: false,
  hasWebGL: false,
  low: false,
  headerLabel: "About",
  probed: false,
  booted: false,
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setHasWebGL: (hasWebGL) => set({ hasWebGL }),
  setLow: (low) => set({ low }),
  setHeaderLabel: (headerLabel) => set({ headerLabel }),
  setProbed: (probed) => set({ probed }),
  setBooted: (booted) => set({ booted }),
}));
