import * as THREE from "three";
import type { FractureResult } from "./fracture";

/**
 * Works out which fragments still sit in front of the revealed photo once fully open, and how much
 * extra spread each one needs to clear it. Replaces the hand-tuned per-index map, which went stale
 * whenever the camera moved and never matched the low-end 14-cell fracture (different cells behind
 * the same indices).
 *
 * Exact test, no bounding volumes: every triangle of a fragment is put at its fully-open pose (same
 * math as stone.vert.glsl with eased = 1), projected from each camera position onto the photo's
 * billboard plane, and checked against the photo rectangle. The extra is searched in `step`
 * increments until no pose sees an overlap. It's ADDITIVE, so a value found at the full spread
 * doesn't overshoot at the smaller preview spread.
 */

export interface CameraPose {
  pos: THREE.Vector3Like;
  target: THREE.Vector3Like;
}

export interface OcclusionParams {
  fracture: FractureResult;
  /** Stone mesh world matrix at its open pose (idle sway snapped back to BASE_TILT). No scale. */
  stoneMatrix: THREE.Matrix4;
  /** Photo billboard center (world) and half extents. */
  photoCenter: THREE.Vector3;
  photoHalf: THREE.Vector2;
  poses: CameraPose[];
  spread: number;
  step?: number;
  maxExtra?: number;
}

const NEAR = 0.1;
const WORLD_UP = new THREE.Vector3(0, 1, 0);

interface Frame {
  pos: THREE.Vector3;
  fwd: THREE.Vector3;
  right: THREE.Vector3;
  up: THREE.Vector3;
  /** Photo center depth and its right/up coordinates, relative to the camera. */
  depthP: number;
  pr: number;
  pu: number;
}

function makeFrame(pose: CameraPose, photoCenter: THREE.Vector3): Frame {
  const pos = new THREE.Vector3().copy(pose.pos);
  const fwd = new THREE.Vector3().copy(pose.target).sub(pos).normalize();
  const right = new THREE.Vector3().crossVectors(fwd, WORLD_UP).normalize();
  const up = new THREE.Vector3().crossVectors(right, fwd);
  const rel = photoCenter.clone().sub(pos);
  return { pos, fwd, right, up, depthP: rel.dot(fwd), pr: rel.dot(right), pu: rel.dot(up) };
}

const _v = new THREE.Vector3();
const tx = [0, 0, 0];
const ty = [0, 0, 0];

/** Separating-axis test between a 2D triangle and the rect [-hx,hx] x [-hy,hy]. */
function triOverlapsRect(hx: number, hy: number): boolean {
  if (Math.max(tx[0], tx[1], tx[2]) < -hx || Math.min(tx[0], tx[1], tx[2]) > hx) return false;
  if (Math.max(ty[0], ty[1], ty[2]) < -hy || Math.min(ty[0], ty[1], ty[2]) > hy) return false;
  for (let e = 0; e < 3; e++) {
    const a = e;
    const b = (e + 1) % 3;
    const c = (e + 2) % 3;
    const nx = ty[a] - ty[b];
    const ny = tx[b] - tx[a];
    const side = (x: number, y: number) => (x - tx[a]) * nx + (y - ty[a]) * ny;
    const sc = side(tx[c], ty[c]);
    const s0 = side(-hx, -hy);
    const s1 = side(hx, -hy);
    const s2 = side(hx, hy);
    const s3 = side(-hx, hy);
    if (sc >= 0 ? Math.max(s0, s1, s2, s3) < 0 : Math.min(s0, s1, s2, s3) > 0) return false;
  }
  return true;
}

/** True if any triangle (world positions, flat xyz triplets) covers part of the photo from `f`. */
function coversPhoto(world: Float32Array, f: Frame, hx: number, hy: number): boolean {
  for (let t = 0; t < world.length; t += 9) {
    let inFront = false;
    let valid = true;
    for (let k = 0; k < 3; k++) {
      _v.set(world[t + k * 3], world[t + k * 3 + 1], world[t + k * 3 + 2]).sub(f.pos);
      const d = _v.dot(f.fwd);
      if (d < NEAR) {
        valid = false;
        break;
      }
      if (d < f.depthP) inFront = true;
      const s = f.depthP / d;
      tx[k] = _v.dot(f.right) * s - f.pr;
      ty[k] = _v.dot(f.up) * s - f.pu;
    }
    if (valid && inFront && triOverlapsRect(hx, hy)) return true;
  }
  return false;
}

export function computeSpreadExtra(params: OcclusionParams): Record<number, number> {
  const { fracture, stoneMatrix, photoCenter, photoHalf, poses, spread, step = 0.05, maxExtra = 3 } = params;
  const frames = poses.map((p) => makeFrame(p, photoCenter));
  const pos = fracture.geometry.getAttribute("position");
  const out: Record<number, number> = {};

  const axis = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const p = new THREE.Vector3();

  fracture.cells.forEach((cell, i) => {
    // Rest pose rotated about the pivot (the open rotation), then into world space. Only the
    // outward translation depends on the extra, so it's added per iteration below.
    const angle = cell.rotAxis.length();
    axis.copy(cell.rotAxis).normalize();
    const base = new Float32Array(cell.vertexCount * 3);
    for (let v = 0; v < cell.vertexCount; v++) {
      p.fromBufferAttribute(pos, cell.vertexStart + v)
        .sub(cell.pivot)
        .applyAxisAngle(axis, angle)
        .add(cell.pivot)
        .applyMatrix4(stoneMatrix);
      base[v * 3] = p.x;
      base[v * 3 + 1] = p.y;
      base[v * 3 + 2] = p.z;
    }
    dir.copy(cell.outDir).transformDirection(stoneMatrix);

    const world = new Float32Array(base.length);
    const blocked = (extra: number) => {
      const d = spread + extra;
      for (let k = 0; k < base.length; k += 3) {
        world[k] = base[k] + dir.x * d;
        world[k + 1] = base[k + 1] + dir.y * d;
        world[k + 2] = base[k + 2] + dir.z * d;
      }
      return frames.some((f) => coversPhoto(world, f, photoHalf.x, photoHalf.y));
    };

    let extra = 0;
    while (extra < maxExtra && blocked(extra)) extra += step;
    if (extra > 0) out[i] = Math.round(extra * 100) / 100;
  });

  return out;
}
