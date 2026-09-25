"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { U } from "./uniforms";
import { sceneRefs } from "./sceneRefs";
import { frameState, useSceneStore } from "@/lib/store";
import { damp } from "@/lib/math";
import { lightTarget } from "./postApi";

const L = new THREE.Vector3();
const HALO_BASE = new THREE.Vector3(0, 2.3, 0);

/**
 * Priority 3, after CameraRig and Monolith (which updates stoneInv), before the post pass.
 * Keeps the light behind the stone and sweeps it with scroll, damps uLightColor to
 * lightTarget, moves halo/mist and updates the stone's object-space camera/light uniforms.
 */
export function LightRig() {
  const sp = useRef(0.5);

  useFrame((state, delta) => {
    const reduced = useSceneStore.getState().reducedMotion;
    const dt = Math.min(delta, 0.1);
    const t = U.uTime.value;
    const cp = frameState.cam.pos;

    const az = Math.atan2(cp.x, cp.z);
    sp.current = reduced ? 0.5 : damp(sp.current, frameState.scroll.progress, 2, dt);
    const th = -az + (sp.current - 0.5) * 2.3 + (reduced ? 0 : Math.sin(t * 0.06) * 0.1);
    L.set(Math.sin(th), 0.34, -Math.cos(th)).normalize();
    U.uLightDir.value.copy(L);
    U.uSunDir.value.set(L.x, 0.05, L.z).normalize();
    U.uLightColor.value.lerp(lightTarget, 1 - Math.exp(-dt * (reduced ? 6 : 1.8)));

    if (sceneRefs.stoneUniforms && sceneRefs.stoneInv) {
      sceneRefs.stoneUniforms.uCamObj.value.copy(state.camera.position).applyMatrix4(sceneRefs.stoneInv);
      sceneRefs.stoneUniforms.uLightObj.value.copy(L).transformDirection(sceneRefs.stoneInv);
    }

    if (sceneRefs.halo) {
      sceneRefs.halo.position.set(L.x, 0, L.z).normalize().multiplyScalar(1.9).add(HALO_BASE);
      sceneRefs.halo.quaternion.copy(state.camera.quaternion);
    }

    if (sceneRefs.photoMesh) {
      sceneRefs.photoMesh.quaternion.copy(state.camera.quaternion);
    }

    for (const card of sceneRefs.mistCards) {
      card.rotation.y = Math.atan2(
        state.camera.position.x - card.position.x,
        state.camera.position.z - card.position.z
      );
    }
  }, 3);

  return null;
}
