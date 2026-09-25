"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { VS_SKY, FS_SKY } from "./shaders";
import { U } from "./uniforms";
import { sceneRefs } from "./sceneRefs";

export function Sky() {
  const ref = useRef<THREE.Mesh>(null);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: U,
        vertexShader: VS_SKY,
        fragmentShader: FS_SKY,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    []
  );

  useEffect(() => {
    sceneRefs.sky = ref.current;
    return () => {
      sceneRefs.sky = null;
    };
  }, []);

  return (
    <mesh ref={ref} renderOrder={-1} frustumCulled={false} material={material}>
      <sphereGeometry args={[80, 48, 24]} />
    </mesh>
  );
}
