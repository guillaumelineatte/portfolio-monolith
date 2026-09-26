"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { VS_GROUND, FS_GROUND } from "./shaders";
import { useSceneStore } from "@/lib/store";
import { U } from "./uniforms";

// Must match ground.vert.glsl's DUNE_CLEAR_R: inside it the floor is flat and a plain disc will do.
const FLAT_R = 12;
const OUTER_R = 110;

/**
 * Polar ground mesh on the XZ plane: a flat disc under the stone, then rings spaced
 * exponentially out to the horizon so each triangle covers roughly the same screen area. A
 * uniform grid (needed for the dunes in ground.vert.glsl) wasted most of its triangles as
 * sub-pixel slivers in the distance, which cost ~4 fps under MSAA.
 */
function buildGroundGeometry(rings: number, segs: number): THREE.BufferGeometry {
  const pos: number[] = [0, 0, 0];
  const ringStart = (i: number) => 1 + i * segs;
  for (let i = 0; i <= rings; i++) {
    const r = FLAT_R * Math.pow(OUTER_R / FLAT_R, i / rings);
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      pos.push(Math.cos(a) * r, 0, Math.sin(a) * r);
    }
  }
  const idx: number[] = [];
  // Centre disc, then quads between consecutive rings (wound so the faces point up).
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

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: U,
        vertexShader: VS_GROUND,
        fragmentShader: FS_GROUND,
      }),
    []
  );

  // Displaced in the vertex shader; the flat bounds are close enough but keep it simple.
  return <mesh material={material} geometry={geometry} frustumCulled={false} />;
}
