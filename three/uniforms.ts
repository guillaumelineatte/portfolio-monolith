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
  };
}

export type SharedUniforms = ReturnType<typeof createSharedUniforms>;

/**
 * Shared uniforms for every material, like `U` in the prototype. A module singleton is fine
 * since <Canvas> only mounts once (components/CanvasRoot.tsx).
 */
export const U: SharedUniforms = createSharedUniforms();
