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
    // How open the stone is (0 closed, 1 fully spread) and how much its photo is showing, written
    // by Monolith every frame: the ground's contact shadow and the photo's glow on the broken
    // faces read them.
    uStoneOpen: { value: 0 },
    uPhotoGlow: { value: 0 },
  };
}

export type SharedUniforms = ReturnType<typeof createSharedUniforms>;

/**
 * Shared uniforms for every material, like `U` in the prototype. A module singleton is fine
 * since <Canvas> only mounts once (components/CanvasRoot.tsx).
 */
export const U: SharedUniforms = createSharedUniforms();
