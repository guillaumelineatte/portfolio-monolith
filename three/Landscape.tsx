"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { VS_RIDGE, FS_RIDGE } from "./shaders";
import { U } from "./uniforms";

/**
 * Layered hills on the horizon. Static, wide enough to cover every camFor() pose.
 */
const LAYERS = [
  { z: -22, y: -1.6, width: 260, height: 12, seed: 1.7, freq: 0.05, ridgeHeight: 3.2, depth: 0.18 },
  { z: -42, y: -1.1, width: 340, height: 16, seed: 5.3, freq: 0.035, ridgeHeight: 4.5, depth: 0.48 },
  { z: -72, y: -0.6, width: 440, height: 20, seed: 9.1, freq: 0.022, ridgeHeight: 5.5, depth: 0.78 },
];

export function Landscape() {
  const materials = useMemo(
    () =>
      LAYERS.map(
        (l) =>
          new THREE.ShaderMaterial({
            uniforms: Object.assign(
              {
                uSeed: { value: l.seed },
                uFreq: { value: l.freq },
                uRidgeHeight: { value: l.ridgeHeight },
                uDepth: { value: l.depth },
              },
              U
            ),
            vertexShader: VS_RIDGE,
            fragmentShader: FS_RIDGE,
          })
      ),
    []
  );

  return (
    <>
      {LAYERS.map((l, i) => (
        <mesh key={i} position={[0, l.y, l.z]} material={materials[i]}>
          {/* Enough columns for the finer crest octaves in ridge.vert.glsl. */}
          <planeGeometry args={[l.width, l.height, 512, 1]} />
        </mesh>
      ))}
    </>
  );
}
