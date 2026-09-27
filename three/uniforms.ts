import * as THREE from "three";

function createSharedUniforms() {
  return {
    uTime: { value: 0 },
    uLightColor: { value: new THREE.Color(1, 0.6, 0.35) },
    uIntensity: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0, 0.06, -1).normalize() },
    uCamPos: { value: new THREE.Vector3() },
    uMist: { value: 1 },
    uLightDir: { value: new THREE.Vector3(0, 0.34, -1).normalize() },
    // set by Monolith every frame: how open the stone is, how visible the photo is
    uStoneOpen: { value: 0 },
    uPhotoGlow: { value: 0 },
  };
}

export type SharedUniforms = ReturnType<typeof createSharedUniforms>;

// Uniforms shared by all materials. A singleton is fine, the Canvas only mounts once.
export const U: SharedUniforms = createSharedUniforms();
