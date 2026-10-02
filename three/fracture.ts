import * as THREE from "three";

// Stone fragments: Voronoi cells cut on the unrolled capsule surface, each one extruded inward
// into a prism, all merged in one geometry. The vertex attributes drive the opening
// (shaders/stone.*.glsl).

// aFaceType: polished outer skin, or broken stone (inner face / cut walls).
export const FACE_OUTER = 0;
export const FACE_INNER = 1;
export const FACE_WALL = 2;

// Leave it out for the coarse version (straight cuts), used by photoOcclusion.ts: same cells,
// way fewer triangles.
export interface FractureDetail {
  // segments per edge, pushed sideways so the break isn't a straight line
  jagSegments: number;
  // sideways offset, fraction of the edge length, capped at jagMax
  jagAmount: number;
  jagMax: number;
  // min rings per face (more rings = follows the curve better)
  rings: number;
  // 0..1, flattens each face toward its own plane (knapped look). Edges don't move.
  facet: number;
  // overall bumpiness so it's not a perfect capsule
  lump: number;
}

export interface FractureParams {
  detail?: FractureDetail;
  radius: number;
  length: number; // straight part, without the caps
  count: number;
  seed: number;
  thickness: number;
}

export interface FractureCellInfo {
  pivot: THREE.Vector3;
  outDir: THREE.Vector3;
  delay: number;
  // extra push added to uSpread (added, not multiplied: a multiplier overshoots at full spread)
  spreadExtra: number;
  // same but only on the project page
  spreadExtraFull: number;
  // axis * angle, same as aRotAxis
  rotAxis: THREE.Vector3;

  vertexStart: number;
  vertexCount: number;
}

export interface FractureResult {
  geometry: THREE.BufferGeometry;
  count: number;
  // same order as the vertex data
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

// denser toward the middle
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

// keep the half of poly that's closer to a than to b
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

// needed at the poles, nothing else bounds the cells there
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

// Longer straight triangles cut under the curve and you see the neighbour's wall through
// (pale slivers on the caps).
const MAX_SPAN = 0.22;
const MAX_RING_SPAN = 0.45;

// Irregular breaks. The offset only depends on the edge, so both cells sharing it get the
// same line and still fit together.
function jagPolygon(poly: Poly, detail: FractureDetail, W: number, H: number): Poly {
  const out: Poly = [];
  const q = (v: number) => Math.round(v * 1000);
  const wrap = (x: number) => ((x % W) + W) % W;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    out.push(a);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    // leave pole edges straight, jagging them pokes past the tip
    const onPole = Math.abs(a.y) > H - 1e-6 && Math.abs(b.y) > H - 1e-6;
    // long edges get more points anyway (MAX_SPAN)
    const segments = Math.max(detail.jagSegments, Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) / MAX_SPAN));
    if (len < 1e-4 || segments < 2 || onPole) continue;
    // same direction for both cells
    const ka = q(wrap(a.x)) * 7919 + q(a.y);
    const kb = q(wrap(b.x)) * 7919 + q(b.y);
    const flip = ka > kb;
    const rng = mulberry32((Math.min(ka, kb) * 31 + Math.max(ka, kb)) >>> 0);
    const phases = [rng() * 6.283, rng() * 6.283, rng() * 6.283];
    const weights = [rng() - 0.5, (rng() - 0.5) * 0.6, (rng() - 0.5) * 0.35];
    const amp = Math.min(detail.jagAmount * len, detail.jagMax);

    const dx = (flip ? a.x - b.x : b.x - a.x) / len;
    const dy = (flip ? a.y - b.y : b.y - a.y) / len;
    for (let k = 1; k < segments; k++) {
      const t = k / segments;
      const tc = flip ? 1 - t : t;
      // 0 at both ends, a few wiggles in between
      let off = 0;
      for (let h = 0; h < 3; h++) off += weights[h] * Math.sin(Math.PI * tc * (h + 1) + phases[h] * h);
      off *= Math.sin(Math.PI * tc) * amp * 2;
      const y = a.y + (b.y - a.y) * t + dx * off;
      out.push({ x: a.x + (b.x - a.x) * t - dy * off, y: Math.max(-H, Math.min(H, y)) });
    }
  }
  return out;
}

export function buildFractureGeometry(params: FractureParams): FractureResult {
  const { radius: R, length: L, count, seed, thickness, detail } = params;
  const halfLen = L / 2;
  const H = halfLen + R;
  const W = 2 * Math.PI * R;
  const Htot = 2 * H;

  const rng = mulberry32(seed);
  const realSeeds = sampleSeeds(count, W, Htot, rng);

  // copies at x-W / x+W so the cells wrap around the seam
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
  const faceTypes: number[] = [];
  const edgeDists: number[] = [];
  const cellsInfo: FractureCellInfo[] = [];

  cells.forEach(({ seed: s, poly: rawPoly }) => {
    const poly = detail ? jagPolygon(rawPoly, detail, W, H) : rawPoly;
    const outerPivot = surfacePoint(s.x, s.y, R, halfLen);
    const nrmPivot = outwardNormal(s.x, s.y, R, halfLen);
    const pivot3 = outerPivot.clone().sub(nrmPivot.clone().multiplyScalar(thickness * 0.5));
    const outDir = nrmPivot.clone();

    // Rings from the seed (ring 0) to the outline. A simple fan breaks now that the outline
    // isn't convex. Big cells (and the caps) get more rings.
    const maxSpoke = Math.max(...poly.map((p) => Math.hypot(p.x - s.x, p.y - s.y)));
    const rings = detail ? Math.max(detail.rings, Math.min(4, Math.ceil(maxSpoke / MAX_RING_SPAN))) : 1;
    const n = poly.length;
    const grid: Vec2[][] = [];
    const edgeDist: number[][] = [];
    for (let r = 0; r <= rings; r++) {
      const f = r / rings;
      grid.push(poly.map((p) => ({ x: s.x + (p.x - s.x) * f, y: s.y + (p.y - s.y) * f })));
      edgeDist.push(poly.map((p) => (1 - f) * Math.hypot(p.x - s.x, p.y - s.y)));
    }
    const centerEdge = edgeDist[0].reduce((a, b) => a + b, 0) / n;
    // capsule + lumps, only depends on the point so neighbours agree
    const lumpAt = (p: Vec2) => {
      if (!detail) return 0;
      const phi = p.x / R;
      const taper = radiusAt(p.y, R, halfLen) / R;
      const l =
        0.5 * Math.sin(2 * phi + 1.3 + 1.7 * p.y) +
        0.35 * Math.sin(3 * phi - 1.7 * p.y + 0.4) +
        0.25 * Math.sin(5 * phi + 3.1 * p.y + 2.2);
      return l * detail.lump * taper;
    };
    const surfaceAt = (p: Vec2) =>
      surfacePoint(p.x, p.y, R, halfLen).add(outwardNormal(p.x, p.y, R, halfLen).multiplyScalar(lumpAt(p)));
    // facet plane
    const planeC = new THREE.Vector3();
    for (const p of poly) planeC.add(surfaceAt(p));
    planeC.divideScalar(n);
    // f = ring fraction, 0 at the seed, 1 on the outline (outline doesn't move)
    const facetW = (f: number) => (detail ? detail.facet * (1 - f * f) : 0);
    const outerAt = (p: Vec2, f = 1) => {
      const v = surfaceAt(p);
      const d = v.clone().sub(planeC).dot(nrmPivot);
      if (d > 0) v.addScaledVector(nrmPivot, -d * facetW(f));
      return v;
    };
    const normalAt = (p: Vec2, f = 1) =>
      outwardNormal(p.x, p.y, R, halfLen).lerp(nrmPivot, facetW(f)).normalize();
    const innerAt = (p: Vec2, f = 1) => outerAt(p, f).sub(normalAt(p, f).multiplyScalar(thickness));

    const bbMin = new THREE.Vector3(Infinity, Infinity, Infinity);
    const bbMax = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    for (const p of [...poly, s]) {
      for (const v of [outerAt(p), innerAt(p)]) {
        bbMin.min(v);
        bbMax.max(v);
      }
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

    const pushVert = (p: THREE.Vector3, nrm: THREE.Vector3, face: number, edge: number) => {
      positions.push(p.x, p.y, p.z);
      normals.push(nrm.x, nrm.y, nrm.z);
      pivots.push(pivot3.x, pivot3.y, pivot3.z);
      outDirs.push(outDir.x, outDir.y, outDir.z);
      rotAxes.push(axis.x, axis.y, axis.z);
      delays.push(delay);
      spreadExtras.push(0);
      boundsMin.push(bbMin.x, bbMin.y, bbMin.z);
      boundsMax.push(bbMax.x, bbMax.y, bbMax.z);
      faceTypes.push(face);
      edgeDists.push(edge);
    };
    // one triangle of the outer or inner face, from (ring, index) points
    const faceTri = (inner: boolean, pts: [number, number][]) => {
      const order = inner ? [pts[0], pts[2], pts[1]] : pts;
      for (const [r, i] of order) {
        const p2 = r === 0 ? s : grid[r][i % n];
        const e = r === 0 ? centerEdge : edgeDist[r][i % n];
        const f = r / rings;
        if (inner) pushVert(innerAt(p2, f), normalAt(p2, f).negate(), FACE_INNER, e);
        else pushVert(outerAt(p2, f), normalAt(p2, f), FACE_OUTER, e);
      }
    };
    for (const inner of [false, true]) {
      for (let i = 0; i < n; i++) {
        faceTri(inner, [
          [0, 0],
          [1, i],
          [1, i + 1],
        ]);
        for (let r = 1; r < rings; r++) {
          faceTri(inner, [
            [r, i],
            [r + 1, i],
            [r + 1, i + 1],
          ]);
          faceTri(inner, [
            [r, i],
            [r + 1, i + 1],
            [r, i + 1],
          ]);
        }
      }
    }

    // cut walls
    const outerPts = poly.map((p) => outerAt(p));
    const innerPts = poly.map((p) => innerAt(p));
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const wallNrm = outerPts[j]
        .clone()
        .sub(outerPts[i])
        .cross(innerPts[i].clone().sub(outerPts[i]))
        .normalize();
      pushVert(outerPts[i], wallNrm, FACE_WALL, 0);
      pushVert(outerPts[j], wallNrm, FACE_WALL, 0);
      pushVert(innerPts[j], wallNrm, FACE_WALL, 0);
      pushVert(outerPts[i], wallNrm, FACE_WALL, 0);
      pushVert(innerPts[j], wallNrm, FACE_WALL, 0);
      pushVert(innerPts[i], wallNrm, FACE_WALL, 0);
    }

    cellsInfo.push({
      pivot: pivot3.clone(),
      outDir: outDir.clone(),
      delay,
      spreadExtra: 0,
      spreadExtraFull: 0,
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
  geometry.setAttribute("aSpreadExtraFull", new THREE.Float32BufferAttribute(spreadExtras.slice(), 1));
  geometry.setAttribute("aBoundsMin", new THREE.Float32BufferAttribute(boundsMin, 3));
  geometry.setAttribute("aBoundsMax", new THREE.Float32BufferAttribute(boundsMax, 3));
  geometry.setAttribute("aFaceType", new THREE.Float32BufferAttribute(faceTypes, 1));
  // distance to the cell outline, for the crack glow
  geometry.setAttribute("aEdgeDist", new THREE.Float32BufferAttribute(edgeDists, 1));

  return { geometry, count: cells.length, cells: cellsInfo };
}

// writes the extra spread into the attributes and the cell info (debug labels read it)
export function setSpreadExtra(
  fracture: FractureResult,
  extra: Record<number, number>,
  extraFull: Record<number, number> = {}
): void {
  const attr = fracture.geometry.getAttribute("aSpreadExtra") as THREE.BufferAttribute;
  const attrFull = fracture.geometry.getAttribute("aSpreadExtraFull") as THREE.BufferAttribute;
  fracture.cells.forEach((cell, i) => {
    cell.spreadExtra = extra[i] ?? 0;
    cell.spreadExtraFull = extraFull[i] ?? 0;
    for (let v = cell.vertexStart; v < cell.vertexStart + cell.vertexCount; v++) {
      attr.setX(v, cell.spreadExtra);
      attrFull.setX(v, cell.spreadExtraFull);
    }
  });
  attr.needsUpdate = true;
  attrFull.needsUpdate = true;
}

// copy the (maybe re-aimed) directions from the coarse build to the detailed one
export function copyOutDirs(from: FractureResult, to: FractureResult): void {
  const attr = to.geometry.getAttribute("aOutDir") as THREE.BufferAttribute;
  to.cells.forEach((cell, i) => {
    cell.outDir.copy(from.cells[i].outDir);
    for (let v = cell.vertexStart; v < cell.vertexStart + cell.vertexCount; v++) {
      attr.setXYZ(v, cell.outDir.x, cell.outDir.y, cell.outDir.z);
    }
  });
  attr.needsUpdate = true;
}
