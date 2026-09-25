"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { U } from "./uniforms";
import { sceneRefs } from "./sceneRefs";
import { frameState, useSceneStore } from "@/lib/store";
import { damp } from "@/lib/math";

/**
 * Priority 1, runs first every frame. Sets uTime, idle drift + mouse parallax, and keeps the
 * sky dome on the camera. First half of the prototype's update(dt).
 */
export function CameraRig() {
  const par = useRef({ x: 0, y: 0 });

  useFrame((state, delta) => {
    const reduced = useSceneStore.getState().reducedMotion;
    const dt = Math.min(delta, 0.1);
    const t = (U.uTime.value = reduced ? 12 : U.uTime.value + dt);

    par.current.x = reduced ? 0 : damp(par.current.x, frameState.pointer.nx, 1.4, dt);
    par.current.y = reduced ? 0 : damp(par.current.y, frameState.pointer.ny, 1.4, dt);

    const cp = frameState.cam.pos;
    const ct = frameState.cam.target;
    let dx = 0;
    let dy = 0;
    let dz = 0;
    if (!reduced) {
      dx = Math.sin(t * 0.047) * 0.3 + Math.sin(t * 0.019 + 1.3) * 0.18;
      dy = Math.sin(t * 0.031) * 0.1;
      dz = Math.cos(t * 0.041) * 0.26;
    }

    const camera = state.camera as THREE.PerspectiveCamera;
    camera.position.set(
      cp.x + dx + par.current.x * 0.45,
      cp.y + dy + par.current.y * 0.2,
      cp.z + dz
    );
    camera.lookAt(ct.x + par.current.x * 0.12, ct.y + par.current.y * 0.05, ct.z);
    U.uCamPos.value.copy(camera.position);

    // fov widens on narrow/tall screens (prototype's resize()).
    const aspect = state.size.width / state.size.height;
    const targetFov = aspect < 0.8 ? 48 : aspect < 1.2 ? 42 : 35;
    if (camera.fov !== targetFov) {
      camera.fov = targetFov;
      camera.updateProjectionMatrix();
    }

    if (sceneRefs.sky) sceneRefs.sky.position.copy(camera.position);
  }, 1);

  return null;
}
