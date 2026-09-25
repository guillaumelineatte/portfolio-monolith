import type * as THREE from "three";

/**
 * Shared refs so CameraRig/LightRig can move the Sky/Halo/Monolith/MistSheets objects every
 * frame without going through React.
 */
export const sceneRefs: {
  sky: THREE.Object3D | null;
  halo: THREE.Object3D | null;
  mistCards: THREE.Object3D[];
  /** The stone mesh (animated every frame, so the mesh itself and not just its inverse). */
  stoneMesh: THREE.Mesh | null;
  stoneInv: THREE.Matrix4 | null;
  stoneUniforms: {
    uCamObj: { value: THREE.Vector3 };
    uLightObj: { value: THREE.Vector3 };
  } | null;
  /** Photo plane. Sibling of the stone, billboarded to the camera every frame. */
  photoMesh: THREE.Object3D | null;
} = {
  sky: null,
  halo: null,
  mistCards: [],
  stoneMesh: null,
  stoneInv: null,
  stoneUniforms: null,
  photoMesh: null,
};
