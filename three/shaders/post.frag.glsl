uniform sampler2D tScene; uniform vec2 uRes; uniform float uGrain; uniform float uExposure;
uniform sampler2D uImgA; uniform sampler2D uImgB; uniform float uImgMix; uniform float uReveal; uniform float uWobble;
uniform vec2 uImgPos; uniform vec2 uImgSize; uniform vec2 uImgVel; uniform float uRectAspect; uniform float uReduced;
varying vec2 vUv;

// Depth of field (not on mobile). Focus is on the stone, the background gets softer.
#ifdef DOF
uniform sampler2D tDepth; uniform float uNear; uniform float uFar; uniform float uFocus;
#define DOF_TAPS 8
#define DOF_MAX_PX 3.0
#define DOF_START 2.0
#define DOF_FULL 7.0
// foreground blur
#define DOF_NEAR 0.8
#define DOF_NEAR_FULL 0.35
#define DOF_NEAR_MAX 0.8
float linDepth(vec2 uv){
  float d = texture2D(tDepth, uv).r;
  return uNear * uFar / (uFar - d * (uFar - uNear));
}
// blur behind the stone and a bit in front too, like a real lens
float coc(float z){
  return max(smoothstep(uFocus * DOF_START, uFocus * DOF_FULL, z), smoothstep(uFocus * DOF_NEAR, uFocus * DOF_NEAR_FULL, z) * DOF_NEAR_MAX);
}
vec3 dof(vec2 uv, vec3 base){
  float c0 = coc(linDepth(uv));
  if (c0 < 0.01) return base;
  vec2 r = vec2(DOF_MAX_PX * uRes.y / 900.0) / uRes * c0;
  float a0 = hash12(gl_FragCoord.xy + 17.0) * 6.2831;
  vec3 acc = base;
  float wsum = 1.0;
  for (int i = 0; i < DOF_TAPS; i++){
    float t = (float(i) + 0.5) / float(DOF_TAPS);
    float a = a0 + float(i) * 2.39996;
    vec2 suv = uv + vec2(cos(a), sin(a)) * sqrt(t) * r;
    // weighted so the sharp stone doesn't bleed into the blurry background
    float w = coc(linDepth(suv));
    acc += texture2D(tScene, suv).rgb * w;
    wsum += w;
  }
  return acc / wsum;
}
#endif

// Cheap bloom before tonemapping, only on what's brighter than BLOOM_THRESHOLD (cracks, sun).
// The grain hides the noise. BLOOM_TAPS is set in PostProcess.
#ifndef BLOOM_TAPS
#define BLOOM_TAPS 10
#endif
#define BLOOM_STRENGTH 0.4
#define BLOOM_THRESHOLD 0.8
#define BLOOM_RADIUS 0.03
float bright(vec2 uv){
  vec3 s = texture2D(tScene, uv).rgb;
  return max(max(s.r, s.g), s.b);
}
vec3 bloom(vec2 uv){
  vec2 r = vec2(uRes.y / uRes.x, 1.0) * BLOOM_RADIUS;
  // skip it where there's nothing bright around (most of the screen)
  float probe = max(max(bright(uv + vec2(r.x, 0.0) * 0.6), bright(uv - vec2(r.x, 0.0) * 0.6)),
                    max(bright(uv + vec2(0.0, r.y) * 0.6), bright(uv - vec2(0.0, r.y) * 0.6)));
  if (max(probe, bright(uv)) < BLOOM_THRESHOLD) return vec3(0.0);
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  float a0 = hash12(gl_FragCoord.xy) * 6.2831;
  for (int i = 0; i < BLOOM_TAPS; i++){
    float t = (float(i) + 0.5) / float(BLOOM_TAPS);
    float a = a0 + float(i) * 2.39996;
    vec3 s = texture2D(tScene, uv + vec2(cos(a), sin(a)) * sqrt(t) * r).rgb;
    float w = 1.0 - t * 0.75;
    acc += max(s - BLOOM_THRESHOLD, 0.0) * w;
    wsum += w;
  }
  return acc / wsum;
}
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec2 coverUv(vec2 uv, float ra){ const float ta = 0.8; vec2 s = ra > ta ? vec2(1.0, ta / ra) : vec2(ra / ta, 1.0); return (uv - 0.5) * s + 0.5; }
void main(){
  vec3 col = texture2D(tScene, vUv).rgb;
#ifdef DOF
  col = dof(vUv, col);
#endif
  col += bloom(vUv) * BLOOM_STRENGTH;
  col = pow(aces(col * uExposure), vec3(1.0 / 2.2));
  if (uReveal > 0.001){
    vec2 local = (gl_FragCoord.xy - uImgPos) / uImgSize + 0.5;
    if (local.x > -0.25 && local.x < 1.25 && local.y > -0.25 && local.y < 1.25){
      float motion = 1.0 - uReduced;
      float vl = length(uImgVel);
      float spd = clamp(vl / 1600.0, 0.0, 1.0) * motion;
      vec2 dir = uImgVel / (vl + 1e-3);
      float t = uTime * 0.3;
      float n1 = snoise(vec3(local * 2.3, t));
      float n2 = snoise(vec3(local * 2.3 + 5.7, t + 3.1));
      float wob = (1.0 - uReveal) + uWobble * 0.6;
      vec2 cl = clamp(local, 0.0, 1.0);
      float bulge = sin(cl.x * 3.14159) * sin(cl.y * 3.14159);
      vec2 uv = local + (vec2(n1, n2) * (0.085 * wob + 0.02 * spd) - dir * spd * 0.11 * bulge) * motion;
      float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
      float frontEdge = uReveal * 1.35 - uv.y - 0.12 + n1 * 0.1;
      float m = mix(smoothstep(0.0, 0.05, frontEdge), uReveal, uReduced) * inside;
      vec2 cuv = coverUv(uv, uRectAspect);
      vec2 ca = dir * spd * 0.012;
      vec3 A = vec3(texture2D(uImgA, cuv + ca).r, texture2D(uImgA, cuv).g, texture2D(uImgA, cuv - ca).b);
      vec3 B = vec3(texture2D(uImgB, cuv + ca).r, texture2D(uImgB, cuv).g, texture2D(uImgB, cuv - ca).b);
      col = mix(col, mix(A, B, uImgMix), m);
    }
  }
  vec2 q = vUv - 0.5; q.x *= uRes.x / uRes.y;
  col *= 1.0 - smoothstep(0.45, 1.25, length(q)) * 0.5;
  float gr = hash12(gl_FragCoord.xy + floor(mod(uTime * 24.0, 97.0)) * vec2(13.1, 29.7)) - 0.5;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col += gr * uGrain * (1.0 - lum * 0.5);
  gl_FragColor = vec4(col, 1.0);
}
