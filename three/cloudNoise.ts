import * as THREE from "three";

// Tileable 3D noise for the clouds (ground.frag.glsl). R = shape, G = detail.
// Built once on the CPU, ~150 ms at 32^3 (64^3 is too slow).

function hash(x: number, y: number, z: number, s: number): number {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + s * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const wrap = (v: number, p: number) => ((v % p) + p) % p;

// F1 worley distance, period `f` cells over the unit cube, ~0 at feature points
function worley(x: number, y: number, z: number, f: number, seed: number): number {
  const px = x * f;
  const py = y * f;
  const pz = z * f;
  const ix = Math.floor(px);
  const iy = Math.floor(py);
  const iz = Math.floor(pz);
  let best = 9;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = ix + dx;
        const cy = iy + dy;
        const cz = iz + dz;
        const wx = wrap(cx, f);
        const wy = wrap(cy, f);
        const wz = wrap(cz, f);
        const fx = cx + hash(wx, wy, wz, seed) - px;
        const fy = cy + hash(wx, wy, wz, seed + 1) - py;
        const fz = cz + hash(wx, wy, wz, seed + 2) - pz;
        const d = fx * fx + fy * fy + fz * fz;
        if (d < best) best = d;
      }
    }
  }
  return Math.min(1, Math.sqrt(best));
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

// gradient noise with period `f`, roughly -1..1
function perlin(x: number, y: number, z: number, f: number, seed: number): number {
  const px = x * f;
  const py = y * f;
  const pz = z * f;
  const ix = Math.floor(px);
  const iy = Math.floor(py);
  const iz = Math.floor(pz);
  const tx = px - ix;
  const ty = py - iy;
  const tz = pz - iz;
  const grad = (cx: number, cy: number, cz: number, ox: number, oy: number, oz: number) => {
    const wx = wrap(cx, f);
    const wy = wrap(cy, f);
    const wz = wrap(cz, f);
    const a = hash(wx, wy, wz, seed) * Math.PI * 2;
    const b = hash(wx, wy, wz, seed + 7) * 2 - 1;
    const r = Math.sqrt(1 - b * b);
    return Math.cos(a) * r * ox + Math.sin(a) * r * oy + b * oz;
  };
  const u = fade(tx);
  const v = fade(ty);
  const w = fade(tz);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const x00 = lerp(grad(ix, iy, iz, tx, ty, tz), grad(ix + 1, iy, iz, tx - 1, ty, tz), u);
  const x10 = lerp(grad(ix, iy + 1, iz, tx, ty - 1, tz), grad(ix + 1, iy + 1, iz, tx - 1, ty - 1, tz), u);
  const x01 = lerp(grad(ix, iy, iz + 1, tx, ty, tz - 1), grad(ix + 1, iy, iz + 1, tx - 1, ty, tz - 1), u);
  const x11 = lerp(grad(ix, iy + 1, iz + 1, tx, ty - 1, tz - 1), grad(ix + 1, iy + 1, iz + 1, tx - 1, ty - 1, tz - 1), u);
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w) * 1.6;
}

const remap = (v: number, a: number, b: number, c: number, d: number) => c + ((v - a) / (b - a)) * (d - c);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function buildCloudNoiseData(size: number): Uint8Array {
  const data = new Uint8Array(size * size * size * 2);
  let i = 0;
  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const w = z / size;
        const per = perlin(u, v, w, 4, 11) * 0.62 + perlin(u, v, w, 8, 23) * 0.26 + perlin(u, v, w, 16, 37) * 0.12;
        const wor1 = (1 - worley(u, v, w, 4, 51)) * 0.625 + (1 - worley(u, v, w, 8, 67)) * 0.25 + (1 - worley(u, v, w, 16, 83)) * 0.125;
        const shape = clamp01(remap(per * 0.5 + 0.5, wor1 - 1, 1, 0, 1));
        const detail = (1 - worley(u, v, w, 8, 97)) * 0.625 + (1 - worley(u, v, w, 16, 113)) * 0.25 + (1 - worley(u, v, w, 32, 131)) * 0.125;
        data[i++] = Math.round(clamp01(shape) * 255);
        data[i++] = Math.round(clamp01(detail) * 255);
      }
    }
  }
  return data;
}

export function createCloudNoiseTexture(size: number): THREE.Data3DTexture {
  const tex = new THREE.Data3DTexture(buildCloudNoiseData(size), size, size, size);
  tex.format = THREE.RGFormat;
  tex.type = THREE.UnsignedByteType;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.RepeatWrapping;
  tex.generateMipmaps = false;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  return tex;
}
