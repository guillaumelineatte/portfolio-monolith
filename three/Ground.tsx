"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { VS_GROUND, FS_GROUND } from "./shaders";
import { useSceneStore } from "@/lib/store";
import { U } from "./uniforms";
import { createCloudNoiseTexture } from "./cloudNoise";

const INNER_R = 0.4;
const OUTER_R = 110;

// Round mesh for the top of the clouds, rings get wider with distance so triangles stay about
// the same size on screen.
function buildGroundGeometry(rings: number, segs: number): THREE.BufferGeometry {
  const pos: number[] = [0, 0, 0];
  const ringStart = (i: number) => 1 + i * segs;
  for (let i = 0; i <= rings; i++) {
    const r = INNER_R * Math.pow(OUTER_R / INNER_R, i / rings);
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      pos.push(Math.cos(a) * r, 0, Math.sin(a) * r);
    }
  }
  const idx: number[] = [];
  // center, then quads between rings (facing up)
  for (let j = 0; j < segs; j++) idx.push(0, ringStart(0) + ((j + 1) % segs), ringStart(0) + j);
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segs; j++) {
      const a = ringStart(i) + j;
      const b = ringStart(i) + ((j + 1) % segs);
      const c = ringStart(i + 1) + j;
      const d = ringStart(i + 1) + ((j + 1) % segs);
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

export function Ground() {
  const low = useSceneStore((s) => s.low);
  const geometry = useMemo(() => (low ? buildGroundGeometry(24, 80) : buildGroundGeometry(32, 112)), [low]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  // 32^3 is enough (it repeats and gets filtered), and builds in ~150 ms
  const cloudTex = useMemo(() => createCloudNoiseTexture(32), []);
  useEffect(() => () => cloudTex.dispose(), [cloudTex]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: Object.assign({ uCloudTex: { value: cloudTex } }, U),
        vertexShader: VS_GROUND,
        fragmentShader: FS_GROUND,
        defines: low ? { LOW_QUALITY: "" } : {},
        // thin clouds let the mountains show through
        transparent: true,
        premultipliedAlpha: true,
        depthWrite: true,
      }),
    [cloudTex, low]
  );

  // drawn first among the transparent stuff (mist sheets, photo, halo go on top)
  return <mesh material={material} geometry={geometry} frustumCulled={false} renderOrder={-1} />;
}
