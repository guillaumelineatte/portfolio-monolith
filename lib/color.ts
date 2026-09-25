import * as THREE from "three";

/**
 * sRGB hex -> linear, by hand. ColorManagement is off (see three/PostProcess.tsx) and the post
 * shader does its own tonemap/gamma, so uniform colors are converted manually.
 */
export function srgbToLinear(hex: string): THREE.Color {
  const c = new THREE.Color(hex);
  c.r = channelToLinear(c.r);
  c.g = channelToLinear(c.g);
  c.b = channelToLinear(c.b);
  return c;
}

function channelToLinear(c: number): number {
  return c <= 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);
}
