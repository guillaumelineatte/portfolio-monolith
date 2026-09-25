import * as THREE from "three";

export function createPlaceholderTexture(): THREE.Texture {
  const tex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}
