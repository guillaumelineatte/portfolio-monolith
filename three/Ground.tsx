"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { VS_WORLD, FS_GROUND } from "./shaders";
import { U } from "./uniforms";

export function Ground() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: U,
        vertexShader: VS_WORLD,
        fragmentShader: FS_GROUND,
      }),
    []
  );

  return (
    <mesh rotation-x={-Math.PI / 2} material={material}>
      <planeGeometry args={[160, 160]} />
    </mesh>
  );
}
