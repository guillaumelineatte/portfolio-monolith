// Sea of clouds under the stone (it used to be a flat, misty desert floor, which read as a flat
// cloud layer anyway). Shared by ground.vert.glsl (shape), ground.frag.glsl (relief, thickness)
// and card.frag.glsl (the mist sheets fade out where they meet it).
//
// Everything here is smooth on purpose: |noise| creases and spherical caps were tried for the
// cumulus tops and drew lines, arcs and tiles (geometric shapes a cloud never has). The puffs are a
// Gaussian-ball field instead; volume comes from them plus brightness driven by thickness.
#define SEA_BASE -0.2
#define SEA_NEAR_AMP 0.6
#define SEA_FAR_AMP 3.2
#define SEA_SCALE 0.2
#define SEA_DRIFT 0.06
// Per-pixel billows: frequency (1 / metres) and height in metres (shading only, never geometry).
#define SEA_PUFF_SCALE 0.2
#define SEA_PUFF_HEIGHT 3.0

vec2 seaWind(){ return normalize(vec2(0.8, 0.6)); }
vec2 seaCoord(vec2 p){ return p * SEA_SCALE - seaWind() * uTime * SEA_DRIFT * SEA_SCALE; }
float seaTime(){ return uTime * 0.008; }

// 0 in the gaps between masses, 1 inside a mass.
float seaMass(vec2 q, float t){
  vec2 w = vec2(snoise(vec3(q * 0.18, 5.0 + t)), snoise(vec3(q * 0.18 + 4.1, 9.0 + t)));
  // Wide ramp: masses swell and taper instead of rising into flat-topped mesas.
  return smoothstep(-0.4, 0.95, snoise(vec3(q * 0.3 + w * 0.9, t * 0.5)));
}
float seaFbm(vec2 q, float t, int oct){
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++){
    if (i >= oct) break;
    s += a * snoise(vec3(q, t * (1.0 + float(i)) + float(i) * 3.1));
    q = mat2(0.8, -0.6, 0.6, 0.8) * q * 2.03 + vec2(1.7, -2.3);
    a *= 0.5;
  }
  return s;
}
// Height above SEA_BASE before the distance amplitude: ~0 in gaps, up to ~1.4 on towering masses.
float seaShape(vec2 p, int oct){
  vec2 q = seaCoord(p);
  float t = seaTime();
  float m = seaMass(q, t);
  return m * (0.35 + 0.5 * (seaFbm(q, t, oct) * 0.5 + 0.5)) + m * m * 0.45;
}
float seaAmp(vec2 p){
  float r = length(p);
  // Low under the stone, and dipping around the camera wherever it is (the About pose sits at
  // y 0.95, and the clouds drift), so no cloud ever passes through the lens.
  float camClear = smoothstep(1.5, 4.5, distance(p, uCamPos.xz));
  return mix(SEA_NEAR_AMP, SEA_FAR_AMP, smoothstep(9.0, 45.0, r)) * mix(0.3, 1.0, smoothstep(0.5, 3.0, r)) * camClear;
}
float seaSurfaceY(vec2 p, int oct){ return SEA_BASE + seaShape(p, oct) * seaAmp(p); }

// Billows finer than the mesh, 0..1. `warp` is computed once per pixel by the caller (it varies
// slowly, so the finite-difference samples can share it).
vec2 seaPuffWarp(vec2 p){
  vec2 q = (p - seaWind() * uTime * SEA_DRIFT) * SEA_PUFF_SCALE * 0.5;
  float t = seaTime();
  return vec2(snoise(vec3(q, 13.0 + t)), snoise(vec3(q + 5.2, 17.0 + t))) * 1.2;
}
vec2 seaHash(vec2 p){
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
// Soft puffs: a sum of Gaussian balls of random size, one per jittered cell (a metaball field).
// Smooth everywhere, so no line, arc or tile can ever show, and it gives the round,
// cauliflower look of cumulus tops.
float seaBalls(vec2 q){
  vec2 i = floor(q);
  vec2 f = fract(q);
  float s = 0.0;
  for (int y = -1; y <= 1; y++){
    for (int x = -1; x <= 1; x++){
      vec2 g = vec2(float(x), float(y));
      vec2 o = seaHash(i + g);
      vec2 r = g + o - f;
      float rnd = fract(o.x * 7.3 + o.y * 3.1);
      float rad = 0.28 + 0.3 * rnd;
      // Some cells stay empty and weights vary, so puffs cluster irregularly.
      float wgt = smoothstep(0.15, 0.4, fract(o.y * 5.7 + o.x * 1.3)) * (0.6 + 0.4 * rnd);
      s += wgt * exp(-dot(r, r) / (rad * rad));
    }
  }
  // Not saturated with 1 - exp(): overlapping balls then flattened the whole field to ~1.
  return smoothstep(0.05, 1.1, s);
}
// Billows finer than the mesh, 0..1: big puffs carrying smaller ones.
float seaPuffs(vec2 p, vec2 warp, int oct){
  vec2 q = (p - seaWind() * uTime * SEA_DRIFT) * SEA_PUFF_SCALE + warp;
  float v = seaBalls(q) * 0.7;
  if (oct > 1) v += seaBalls(q * 2.6 + vec2(3.3, 1.9)) * 0.3;
  return v;
}
