import * as THREE from "three";
import type { FractureResult } from "./fracture";

/**
 * Keeps the fragments out of the revealed photo. Replaces the hand-tuned per-index map, which went
 * stale whenever the camera moved and never matched the low-end 14-cell fracture (different cells
 * behind the same indices).
 *
 * Exact test, no bounding volumes: every triangle of a fragment is put at its fully-open pose (same
 * math as stone.vert.glsl with eased = 1), projected from each camera position onto the photo's
 * billboard plane, and checked against the photo rectangle. Two stages are solved per fragment
 * (home hover at the preview spread, project page at the full spread), each for the smallest
 * ADDITIVE extra push that clears it. A fragment that would need too much (or can't be cleared at
 * all, it travels toward the camera rather than out of the way) is re-aimed sideways instead.
 */

export interface CameraPose {
  pos: THREE.Vector3Like;
  target: THREE.Vector3Like;
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

/** A cell's fully-open triangles (rest pose + open rotation about its pivot) in world space,
 * before any outward translation, plus their centroid. */
function openPoseWorld(fracture: FractureResult, cellIndex: number, stoneMatrix: THREE.Matrix4, rotScale = 1) {
  const cell = fracture.cells[cellIndex];
  const pos = fracture.geometry.getAttribute("position");
  const angle = cell.rotAxis.length() * rotScale;
  const axis = cell.rotAxis.clone().normalize();
  const base = new Float32Array(cell.vertexCount * 3);
  const centroid = new THREE.Vector3();
  const p = new THREE.Vector3();
  for (let v = 0; v < cell.vertexCount; v++) {
    p.fromBufferAttribute(pos, cell.vertexStart + v)
      .sub(cell.pivot)
      .applyAxisAngle(axis, angle)
      .add(cell.pivot)
      .applyMatrix4(stoneMatrix);
    base[v * 3] = p.x;
    base[v * 3 + 1] = p.y;
    base[v * 3 + 2] = p.z;
    centroid.add(p);
  }
  centroid.divideScalar(Math.max(1, cell.vertexCount));
  return { base, centroid };
}

/** Smallest extra (in `step` increments) that clears the photo from every frame, or null if
 * nothing up to `maxExtra` does (the fragment travels toward the camera, not out of its way). */
function extraForCell(
  fracture: FractureResult,
  cellIndex: number,
  stoneMatrix: THREE.Matrix4,
  frames: Frame[],
  photoHalf: THREE.Vector2,
  spread: number,
  rotScale: number,
  step: number,
  maxExtra: number
): number | null {
  const { base } = openPoseWorld(fracture, cellIndex, stoneMatrix, rotScale);
  const dir = fracture.cells[cellIndex].outDir.clone().transformDirection(stoneMatrix);
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
  while (extra <= maxExtra && blocked(extra)) extra += step;
  return extra > maxExtra ? null : Math.round(extra * 100) / 100;
}

/**
 * Re-aims a fragment's outward direction so it slides sideways out of the photo instead of
 * toward the camera: the part of (centroid - photo) perpendicular to the camera axis, i.e. straight
 * away from the photo on screen. Rewrites both the cell info and its aOutDir attribute.
 */
function deflectSideways(
  fracture: FractureResult,
  cellIndex: number,
  stoneMatrix: THREE.Matrix4,
  camPos: THREE.Vector3,
  photoCenter: THREE.Vector3
): void {
  const cell = fracture.cells[cellIndex];
  const { centroid } = openPoseWorld(fracture, cellIndex, stoneMatrix);
  const viewAxis = camPos.clone().sub(photoCenter).normalize();
  const side = centroid.sub(photoCenter);
  side.addScaledVector(viewAxis, -side.dot(viewAxis));
  if (side.lengthSq() < 1e-6) {
    // Dead center: fall back to its own direction minus the camera-facing part.
    side.copy(cell.outDir).transformDirection(stoneMatrix);
    side.addScaledVector(viewAxis, -side.dot(viewAxis));
  }
  const inv = new THREE.Matrix4().copy(stoneMatrix).invert();
  cell.outDir.copy(side).transformDirection(inv);

  const attr = fracture.geometry.getAttribute("aOutDir") as THREE.BufferAttribute;
  for (let v = cell.vertexStart; v < cell.vertexStart + cell.vertexCount; v++) {
    attr.setXYZ(v, cell.outDir.x, cell.outDir.y, cell.outDir.z);
  }
  attr.needsUpdate = true;
}

export interface ClearanceStage {
  poses: CameraPose[];
  spread: number;
  /** Open-rotation multiplier at this stage (stone.vert.glsl's 1 + WAVE_ROT_BOOST * expand). */
  rotScale?: number;
}

export interface ClearanceParams {
  fracture: FractureResult;
  stoneMatrix: THREE.Matrix4;
  photoCenter: THREE.Vector3;
  photoHalf: THREE.Vector2;
  /** Home hover (SPREAD_PREVIEW, home camera) and project page (SPREAD_FULL, project camera). */
  preview: ClearanceStage;
  full: ClearanceStage;
  step?: number;
  maxExtra?: number;
  /** Past this much extra push, re-aim sideways instead: a fragment flying that much further than
   * its neighbours reads as a glitch. */
  deflectAbove?: number;
}

export interface ClearanceResult {
  /** Always applied (aSpreadExtra): clears the photo at the preview stage. */
  extra: Record<number, number>;
  /** Added on top once fully open (aSpreadExtraFull), only what the full stage needs beyond
   * `extra`, never negative so no fragment moves back in between hover and project page. */
  extraFull: Record<number, number>;
  /** Cells no reasonable push could clear, re-aimed sideways by deflectSideways(). */
  deflected: number[];
}

/**
 * Per fragment: find the push each stage needs; if one can't be cleared at all, re-aim the
 * fragment sideways (mutates the fracture's aOutDir) and search again.
 */
export function solveFragmentClearance(params: ClearanceParams): ClearanceResult {
  const { fracture, stoneMatrix, photoCenter, photoHalf, preview, full, step = 0.05, maxExtra = 3 } = params;
  const deflectAbove = params.deflectAbove ?? maxExtra;
  const stages = [preview, full].map((s) => ({ ...s, frames: s.poses.map((p) => makeFrame(p, photoCenter)) }));
  const result: ClearanceResult = { extra: {}, extraFull: {}, deflected: [] };

  fracture.cells.forEach((_cell, i) => {
    const solve = () =>
      stages.map((s) => extraForCell(fracture, i, stoneMatrix, s.frames, photoHalf, s.spread, s.rotScale ?? 1, step, maxExtra));
    let [ePrev, eFull] = solve();
    const tooFar = (e: number | null) => e === null || e > deflectAbove;
    const stuck = tooFar(ePrev) ? stages[0] : tooFar(eFull) ? stages[1] : null;
    if (stuck) {
      const camAvg = new THREE.Vector3();
      for (const p of stuck.poses) camAvg.add(p.pos);
      camAvg.divideScalar(stuck.poses.length);
      deflectSideways(fracture, i, stoneMatrix, camAvg, photoCenter);
      result.deflected.push(i);
      [ePrev, eFull] = solve();
    }
    const a = ePrev ?? maxExtra;
    const b = eFull ?? maxExtra;
    if (a > 0) result.extra[i] = a;
    if (b > a) result.extraFull[i] = Math.round((b - a) * 100) / 100;
  });

  return result;
}
