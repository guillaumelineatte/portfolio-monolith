import * as THREE from "three";
import type { FractureResult } from "./fracture";

// Keeps the fragments from covering the photo.
//
// Every triangle of a fragment is placed where it ends up fully open, projected from each camera
// onto the photo plane and tested against the photo rectangle. We look for the smallest extra
// push that clears it, for the hover and for the project page. If it needs too much (or goes
// toward the camera), the fragment gets re-aimed sideways.

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
  // photo center relative to the camera
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

// SAT test, 2D triangle vs rect [-hx,hx] x [-hy,hy]
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

// does any triangle cover part of the photo from this camera
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

// a cell's triangles fully open (rotated, not pushed out yet) in world space + centroid
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

// smallest extra push that clears the photo, null if nothing up to maxExtra works
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

// Re-aims a fragment so it slides away from the photo on screen instead of toward the camera.
// Updates the cell info and aOutDir.
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
    // right in the middle: use its own direction minus the part facing the camera
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
  // rotation multiplier at this stage
  rotScale?: number;
}

export interface ClearanceParams {
  fracture: FractureResult;
  stoneMatrix: THREE.Matrix4;
  photoCenter: THREE.Vector3;
  photoHalf: THREE.Vector2;
  // hover (home camera) and project page (project camera)
  preview: ClearanceStage;
  full: ClearanceStage;
  step?: number;
  maxExtra?: number;
  // above this, re-aim sideways instead (looks like a glitch otherwise)
  deflectAbove?: number;
}

export interface ClearanceResult {
  // always applied
  extra: Record<number, number>;
  // added on the project page only, never negative (nothing moves back in)
  extraFull: Record<number, number>;
  // cells that got re-aimed
  deflected: number[];
}

// For each fragment: find the push needed at each stage, re-aim it if needed and try again.
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
