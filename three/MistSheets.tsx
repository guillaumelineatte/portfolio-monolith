"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { VS_CARD, FS_CARD } from "./shaders";
import { U } from "./uniforms";
import { sceneRefs } from "./sceneRefs";
import { useSceneStore } from "@/lib/store";

const CARD_DEFS_LOW: [number, number, number, number][] = [
  [-3.0, 0.7, 2.2, 0.3],
  [1.2, 0.85, -2.4, 3.1],
];
const CARD_DEFS_FULL: [number, number, number, number][] = [
  [-3.2, 0.7, 2.4, 0.3],
  [3.6, 0.6, 1.2, 1.7],
  [0.4, 0.85, -2.4, 3.1],
  [-5.5, 0.6, -1.4, 4.4],
  [5.2, 0.9, -3.6, 5.9],
];

export function MistSheets() {
  const low = useSceneStore((s) => s.low);
  const defs = low ? CARD_DEFS_LOW : CARD_DEFS_FULL;
  const refs = useRef<(THREE.Mesh | null)[]>([]);

  const materials = useMemo(
    () =>
      defs.map(
        ([, , , seed]) =>
          new THREE.ShaderMaterial({
            uniforms: Object.assign({ uSeed: { value: seed } }, U),
            vertexShader: VS_CARD,
            fragmentShader: FS_CARD,
            transparent: true,
            depthWrite: false,
          })
      ),
    [defs]
  );

  useEffect(() => {
    sceneRefs.mistCards = refs.current.filter((m): m is THREE.Mesh => !!m);
    return () => {
      sceneRefs.mistCards = [];
    };
  }, [materials]);

  return (
    <>
      {defs.map(([x, y, z], i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          position={[x, y, z]}
          material={materials[i]}
        >
          <planeGeometry args={[11, 2.4]} />
        </mesh>
      ))}
    </>
  );
}
