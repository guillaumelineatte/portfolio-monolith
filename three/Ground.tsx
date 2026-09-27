"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { VS_GROUND, FS_GROUND } from "./shaders";
import { useSceneStore } from "@/lib/store";
import { U } from "./uniforms";

const INNER_R = 0.4;
const OUTER_R = 110;

// Round mesh for the sea of clouds, rings get wider with distance so triangles stay about the
// same size on screen. A regular grid wasted tons of tiny triangles far away (~3 fps).
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
  const geometry = useMemo(() => (low ? buildGroundGeometry(36, 96) : buildGroundGeometry(48, 144)), [low]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: U,
        vertexShader: VS_GROUND,
        fragmentShader: FS_GROUND,
      }),
    []
  );

  // moved in the vertex shader, skip culling
  return <mesh material={material} geometry={geometry} frustumCulled={false} />;
}
