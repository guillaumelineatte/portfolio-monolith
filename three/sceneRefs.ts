import type * as THREE from "three";

// Refs so CameraRig/LightRig can move things every frame without React.
export const sceneRefs: {
  sky: THREE.Object3D | null;
  halo: THREE.Object3D | null;
  mistCards: THREE.Object3D[];
  // stone mesh
  stoneMesh: THREE.Mesh | null;
  stoneInv: THREE.Matrix4 | null;
  stoneUniforms: {
    uCamObj: { value: THREE.Vector3 };
    uLightObj: { value: THREE.Vector3 };
  } | null;
  // photo plane, faces the camera
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
