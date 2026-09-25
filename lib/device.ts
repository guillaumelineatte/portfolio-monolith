const isBrowser = typeof window !== "undefined";

export function prefersReducedMotion(): boolean {
  return isBrowser && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function isCoarsePointer(): boolean {
  return isBrowser && window.matchMedia("(pointer: coarse)").matches;
}

export function isNarrow(): boolean {
  return isBrowser && window.innerWidth < 768;
}

export function canHover(): boolean {
  return isBrowser && window.matchMedia("(hover: hover) and (pointer: fine)").matches && !isNarrow();
}

export function isLow(): boolean {
  return isNarrow() || isCoarsePointer();
}

export function probeWebGL(): boolean {
  if (!isBrowser) return false;
  try {
    const canvas = document.createElement("canvas");
    const ctx = (canvas.getContext("webgl2") ||
      canvas.getContext("webgl")) as WebGLRenderingContext | null;
    const ok = !!ctx;
    // Free the probe context explicitly. Strict Mode runs this twice and leaked contexts ended
    // up hitting the WebGL context limit (canvas not rendering, "Context Lost").
    ctx?.getExtension("WEBGL_lose_context")?.loseContext();
    return ok;
  } catch {
    return false;
  }
}
