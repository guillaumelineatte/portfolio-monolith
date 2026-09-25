import * as THREE from "three";

/**
 * Fragment geometry for the stone. The capsule surface is cut into Voronoi cells in an
 * unrolled cylindrical space (so the cuts follow the curve), each cell is extruded inward into
 * a prism, and everything goes into one BufferGeometry. Per-vertex attributes drive the open
 * animation, see three/shaders/stone.*.glsl.
 */

export interface FractureParams {
  radius: number;
  length: number; // cylindrical section length (excludes the hemispherical caps)
  count: number;
  seed: number;
  thickness: number;
}

export interface FractureCellInfo {
  pivot: THREE.Vector3;
  outDir: THREE.Vector3;
  delay: number;
  /** Extra spread, object space, ADDED to uSpread (not multiplied, that overshoots at SPREAD_FULL).
   * 0 at build time, filled in by setSpreadExtra() from photoOcclusion.ts. */
  spreadExtra: number;
  /** Axis * angle of the open rotation, same as the aRotAxis attribute. */
  rotAxis: THREE.Vector3;
  /** Vertex range in the merged geometry. */
  vertexStart: number;
  vertexCount: number;
}

export interface FractureResult {
  geometry: THREE.BufferGeometry;
  seedsXY: Float32Array; // unrolled (x,y) per real seed, for the shader's edge-glow uniform
  count: number;
  /** Pivot/outDir/delay per cell, same order as the vertex attributes (used by the debug labels). */
  cells: FractureCellInfo[];
}

interface Vec2 {
  x: number;
  y: number;
}
type Poly = Vec2[];

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Rejection-sampled seeds, biased denser toward the unrolled space's center. */
function sampleSeeds(count: number, W: number, H: number, rng: () => number): Vec2[] {
  const seeds: Vec2[] = [];
  let guard = 0;
  while (seeds.length < count && guard < count * 400) {
    guard++;
    const x = (rng() - 0.5) * W;
    const y = (rng() - 0.5) * H;
    const distNorm = Math.hypot(x / (W / 2), y / (H / 2));
    const density = 1.0 - 0.55 * Math.min(1, distNorm);
    if (rng() < density) seeds.push({ x, y });
  }
  return seeds;
}

/** Sutherland-Hodgman clip of `poly` by the half-plane closer to `a` than to `b`. */
function clipHalfPlane(poly: Poly, a: Vec2, b: Vec2): Poly {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const nx = b.x - a.x;
  const ny = b.y - a.y;
  const side = (p: Vec2) => (p.x - mx) * nx + (p.y - my) * ny;
  const out: Poly = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const prev = poly[(i - 1 + poly.length) % poly.length];
    const curSide = side(cur);
    const prevSide = side(prev);
    if (curSide <= 0) {
      if (prevSide > 0) {
        const t = prevSide / (prevSide - curSide);
        out.push({ x: prev.x + t * (cur.x - prev.x), y: prev.y + t * (cur.y - prev.y) });
      }
      out.push(cur);
    } else if (prevSide <= 0) {
      const t = prevSide / (prevSide - curSide);
      out.push({ x: prev.x + t * (cur.x - prev.x), y: prev.y + t * (cur.y - prev.y) });
    }
  }
  return out;
}

/** Clips the polygon to one side of a horizontal line. Needed near the poles, there's no
    ghost seed there to bound the cells. */
function clipHorizontal(poly: Poly, limit: number, keepBelow: boolean): Poly {
  const inside = (p: Vec2) => (keepBelow ? p.y <= limit : p.y >= limit);
  const out: Poly = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const prev = poly[(i - 1 + poly.length) % poly.length];
    const curIn = inside(cur);
    const prevIn = inside(prev);
    if (curIn) {
      if (!prevIn) {
        const t = (limit - prev.y) / (cur.y - prev.y);
        out.push({ x: prev.x + t * (cur.x - prev.x), y: limit });
      }
      out.push(cur);
    } else if (prevIn) {
      const t = (limit - prev.y) / (cur.y - prev.y);
      out.push({ x: prev.x + t * (cur.x - prev.x), y: limit });
    }
  }
  return out;
}

function buildCell(seed: Vec2, others: Vec2[], W: number, H: number, poleLimit: number): Poly {
  let poly: Poly = [
    { x: -W, y: -H },
    { x: W, y: -H },
    { x: W, y: H },
    { x: -W, y: H },
  ];
  const sorted = others
    .slice()
    .sort((p, q) => Math.hypot(p.x - seed.x, p.y - seed.y) - Math.hypot(q.x - seed.x, q.y - seed.y));
  for (const o of sorted) {
    if (poly.length < 3) break;
    poly = clipHalfPlane(poly, seed, o);
  }
  if (poly.length >= 3) poly = clipHorizontal(poly, poleLimit, true);
  if (poly.length >= 3) poly = clipHorizontal(poly, -poleLimit, false);
  return poly;
}

function radiusAt(y: number, R: number, halfLen: number): number {
  const ay = Math.abs(y);
  if (ay <= halfLen) return R;
  const dy = ay - halfLen;
  return Math.sqrt(Math.max(0, R * R - dy * dy));
}

function surfacePoint(x: number, y: number, R: number, halfLen: number): THREE.Vector3 {
  const phi = x / R;
  const r = radiusAt(y, R, halfLen);
  return new THREE.Vector3(r * Math.cos(phi), y, r * Math.sin(phi));
}

function outwardNormal(x: number, y: number, R: number, halfLen: number): THREE.Vector3 {
  const ay = Math.abs(y);
  if (ay <= halfLen) {
    const phi = x / R;
    return new THREE.Vector3(Math.cos(phi), 0, Math.sin(phi));
  }
  const capCenterY = halfLen * Math.sign(y);
  const p = surfacePoint(x, y, R, halfLen);
  return p.clone().sub(new THREE.Vector3(0, capCenterY, 0)).normalize();
}

export function buildFractureGeometry(params: FractureParams): FractureResult {
  const { radius: R, length: L, count, seed, thickness } = params;
  const halfLen = L / 2;
  const H = halfLen + R;
  const W = 2 * Math.PI * R;
  const Htot = 2 * H;

  const rng = mulberry32(seed);
  const realSeeds = sampleSeeds(count, W, Htot, rng);

  // Ghost copies at x-W / x+W so cells wrap correctly across the phi=0/2*PI seam.
  const allSeeds: Vec2[] = [];
  for (const s of realSeeds) allSeeds.push(s, { x: s.x - W, y: s.y }, { x: s.x + W, y: s.y });

  const cells: { seed: Vec2; poly: Poly }[] = [];
  let maxDelayDist = 1e-6;
  for (const s of realSeeds) {
    const others = allSeeds.filter((o) => o !== s);
    const poly = buildCell(s, others, W, Htot, H);
    if (poly.length >= 3) {
      cells.push({ seed: s, poly });
      maxDelayDist = Math.max(maxDelayDist, Math.hypot(s.x, s.y));
    }
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const pivots: number[] = [];
  const outDirs: number[] = [];
  const rotAxes: number[] = [];
  const delays: number[] = [];
  const spreadExtras: number[] = [];
  const boundsMin: number[] = [];
  const boundsMax: number[] = [];
  const cellsInfo: FractureCellInfo[] = [];

  cells.forEach(({ seed: s, poly }) => {
    const outerPivot = surfacePoint(s.x, s.y, R, halfLen);
    const nrmPivot = outwardNormal(s.x, s.y, R, halfLen);
    const pivot3 = outerPivot.clone().sub(nrmPivot.clone().multiplyScalar(thickness * 0.5));
    const outDir = nrmPivot.clone();

    const outerPts = poly.map((p) => surfacePoint(p.x, p.y, R, halfLen));
    const outerNormals = poly.map((p) => outwardNormal(p.x, p.y, R, halfLen));
    const innerPts = outerPts.map((p, i) => p.clone().sub(outerNormals[i].clone().multiplyScalar(thickness)));

    const bbMin = new THREE.Vector3(Infinity, Infinity, Infinity);
    const bbMax = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    for (const p of [...outerPts, ...innerPts]) {
      bbMin.min(p);
      bbMax.max(p);
    }
    bbMin.subScalar(0.015);
    bbMax.addScalar(0.015);

    const rng2 = mulberry32((Math.floor(s.x * 131 + s.y * 977) + seed * 7919) >>> 0);
    const axis = new THREE.Vector3(rng2() - 0.5, rng2() - 0.5, rng2() - 0.5).normalize();
    const angleDeg = 8 + rng2() * 7;
    axis.multiplyScalar((angleDeg * Math.PI) / 180);

    const distToCenter = Math.hypot(s.x, s.y);
    const delay = (distToCenter / maxDelayDist) * 0.75;
    const vertexStart = positions.length / 3;

    const n = poly.length;
    const pushVert = (p: THREE.Vector3, nrm: THREE.Vector3) => {
      positions.push(p.x, p.y, p.z);
      normals.push(nrm.x, nrm.y, nrm.z);
      pivots.push(pivot3.x, pivot3.y, pivot3.z);
      outDirs.push(outDir.x, outDir.y, outDir.z);
      rotAxes.push(axis.x, axis.y, axis.z);
      delays.push(delay);
      spreadExtras.push(0);
      boundsMin.push(bbMin.x, bbMin.y, bbMin.z);
      boundsMax.push(bbMax.x, bbMax.y, bbMax.z);
    };

    for (let i = 1; i < n - 1; i++) {
      pushVert(outerPts[0], outerNormals[0]);
      pushVert(outerPts[i], outerNormals[i]);
      pushVert(outerPts[i + 1], outerNormals[i + 1]);
    }
    for (let i = 1; i < n - 1; i++) {
      pushVert(innerPts[0], outerNormals[0].clone().negate());
      pushVert(innerPts[i + 1], outerNormals[i + 1].clone().negate());
      pushVert(innerPts[i], outerNormals[i].clone().negate());
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const wallNrm = outerPts[j]
        .clone()
        .sub(outerPts[i])
        .cross(innerPts[i].clone().sub(outerPts[i]))
        .normalize();
      pushVert(outerPts[i], wallNrm);
      pushVert(outerPts[j], wallNrm);
      pushVert(innerPts[j], wallNrm);
      pushVert(outerPts[i], wallNrm);
      pushVert(innerPts[j], wallNrm);
      pushVert(innerPts[i], wallNrm);
    }

    cellsInfo.push({
      pivot: pivot3.clone(),
      outDir: outDir.clone(),
      delay,
      spreadExtra: 0,
      rotAxis: axis.clone(),
      vertexStart,
      vertexCount: positions.length / 3 - vertexStart,
    });
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("aPivot", new THREE.Float32BufferAttribute(pivots, 3));
  geometry.setAttribute("aOutDir", new THREE.Float32BufferAttribute(outDirs, 3));
  geometry.setAttribute("aRotAxis", new THREE.Float32BufferAttribute(rotAxes, 3));
  geometry.setAttribute("aDelay", new THREE.Float32BufferAttribute(delays, 1));
  geometry.setAttribute("aSpreadExtra", new THREE.Float32BufferAttribute(spreadExtras, 1));
  geometry.setAttribute("aBoundsMin", new THREE.Float32BufferAttribute(boundsMin, 3));
  geometry.setAttribute("aBoundsMax", new THREE.Float32BufferAttribute(boundsMax, 3));

  const seedsXY = new Float32Array(cells.length * 2);
  cells.forEach(({ seed: s }, i) => {
    seedsXY[i * 2] = s.x;
    seedsXY[i * 2 + 1] = s.y;
  });

  return { geometry, seedsXY, count: cells.length, cells: cellsInfo };
}

/** Writes extra spread per cell index into the aSpreadExtra attribute and the matching cell info,
 * so the shader and the JS mirror of it (debug labels) stay in sync. */
export function setSpreadExtra(fracture: FractureResult, extra: Record<number, number>): void {
  const attr = fracture.geometry.getAttribute("aSpreadExtra") as THREE.BufferAttribute;
  fracture.cells.forEach((cell, i) => {
    cell.spreadExtra = extra[i] ?? 0;
    for (let v = cell.vertexStart; v < cell.vertexStart + cell.vertexCount; v++) attr.setX(v, cell.spreadExtra);
  });
  attr.needsUpdate = true;
}
