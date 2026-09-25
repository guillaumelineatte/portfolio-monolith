"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { VS_UV, FS_HALO } from "./shaders";
import { U } from "./uniforms";
import { sceneRefs } from "./sceneRefs";

export function Halo() {
  const ref = useRef<THREE.Mesh>(null);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: U,
        vertexShader: VS_UV,
        fragmentShader: FS_HALO,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  );

  useEffect(() => {
    sceneRefs.halo = ref.current;
    return () => {
      sceneRefs.halo = null;
    };
  }, []);

  return (
    <mesh ref={ref} material={material}>
      <planeGeometry args={[10, 10]} />
    </mesh>
  );
}
