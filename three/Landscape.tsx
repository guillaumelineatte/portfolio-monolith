"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { VS_RIDGE, FS_RIDGE } from "./shaders";
import { U } from "./uniforms";
import { useSceneStore } from "@/lib/store";

// Mountain ranges on the horizon (shape in ridge.vert.glsl). Wide enough for every camera pose.
// top = crest height, span = depth of the strip.
const LAYERS = [
  { z: -22, top: 4.4, span: 18, width: 260, seed: 1.7, freq: 0.05, ridgeHeight: 3.2, rough: 3.4, depth: 0.18 },
  { z: -42, top: 6.9, span: 26, width: 340, seed: 5.3, freq: 0.035, ridgeHeight: 4.5, rough: 4.2, depth: 0.48 },
  { z: -72, top: 9.4, span: 34, width: 440, seed: 9.1, freq: 0.022, ridgeHeight: 5.5, rough: 5.0, depth: 0.78 },
];

export function Landscape() {
  const low = useSceneStore((s) => s.low);
  const cols = low ? 256 : 640;
  const rows = low ? 16 : 40;

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
                uTop: { value: l.top },
                uBase: { value: -3 },
                uZ: { value: l.z },
                uDepthSpan: { value: l.span },
                uRough: { value: l.rough },
              },
              U
            ),
            vertexShader: VS_RIDGE,
            fragmentShader: FS_RIDGE,
            defines: low ? { LOW_QUALITY: "" } : {},
          })
      ),
    [low]
  );

  return (
    <>
      {LAYERS.map((l, i) => (
        // everything happens in the vertex shader, the bounds are wrong, so no culling
        <mesh key={i} material={materials[i]} frustumCulled={false}>
          <planeGeometry args={[l.width, l.span, cols, rows]} />
        </mesh>
      ))}
    </>
  );
}
