uniform vec3 uCamObj; uniform vec3 uLightObj; uniform vec3 uHalf; uniform float uGain;
uniform int uSteps;
uniform float uCrack;
uniform vec2 uSeeds[32];
uniform int uSeedCount;

// Broken-stone look (see main). Diffuse strength vs the skin's 0.28, how far light wraps past the
// terminator, share of the volumetric interior still showing through, glint strength.
#define RAW_DIFFUSE 0.62
#define RAW_WRAP 0.25
// How much of the route's light colour tints the broken stone (1 = fully, like the skin). Lower
// keeps fresh breaks paler than the weathered skin.
#define RAW_TINT 0.6
#define RAW_VOLUME 0.55
#define RAW_GLINT 0.7
varying vec3 vObj; varying vec3 vNrm; varying vec3 vWorld;
varying vec3 vBoundsMin; varying vec3 vBoundsMax;
varying float vFace; // fracture.ts FACE_*: 0 polished outer skin, 1/2 freshly broken (inner face, cut walls)

float boxExit(vec3 ro, vec3 rd, vec3 hb){
  vec3 s = step(0.0, rd) * 2.0 - 1.0;
  vec3 t = (s * hb - ro) * s / max(abs(rd), vec3(1e-5));
  return max(min(min(t.x, t.y), t.z), 0.0);
}
vec3 palette(float t){
  vec3 amber = vec3(1.00, 0.58, 0.26);
  vec3 rose  = vec3(0.98, 0.50, 0.58);
  vec3 blue  = vec3(0.56, 0.70, 0.98);
  t = clamp(t, 0.0, 1.0) * 2.0;
  return t < 1.0 ? mix(amber, rose, smoothstep(0.0, 1.0, t)) : mix(rose, blue, smoothstep(1.0, 2.0, t));
}

/** Inverse of the unroll in fracture.ts (phi*radius, y), to find the closest cell per pixel. */
vec2 toUnrolled(vec3 p){
  float phi = atan(p.z, p.x);
  return vec2(phi * uHalf.x, p.y);
}

/** Approx distance to the nearest Voronoi edge (~0 on the bisector). These are the cracks
    that glow with uCrack. */
float voronoiEdge(vec3 p){
  vec2 uv = toUnrolled(p);
  float jitter = snoise(p * 3.0) * 0.035;
  float d1 = 1e9; float d2 = 1e9;
  for (int i = 0; i < 32; i++){
    if (i >= uSeedCount) break;
    float d = distance(uv, uSeeds[i]) + jitter;
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return (d2 - d1) * 0.5;
}

void main(){
  vec3 ro = vObj;
  vec3 rd = normalize(vObj - uCamObj);
  vec3 L = normalize(uLightObj);
  vec3 n = normalize(vNrm);

  vec3 fragCenter = (vBoundsMin + vBoundsMax) * 0.5;
  vec3 fragHalf = (vBoundsMax - vBoundsMin) * 0.5;
  float tExit = boxExit(ro - fragCenter, rd, fragHalf);
  float dt = tExit / float(max(uSteps, 1));
  float jit = hash12(gl_FragCoord.xy + fract(uTime * 3.7) * 61.0);
  float c = dot(rd, L);
  const float g = 0.6;
  float hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * c, 1.5);
  float phase = 0.3 + hg * 0.18;
  vec3 acc = vec3(0.0); float T = 1.0;
  for (int i = 0; i < STEPS; i++){
    if (i >= uSteps) break;
    vec3 p = ro + rd * ((float(i) + jit) * dt);
    float w = snoise(p * vec3(0.62, 0.34, 0.62) + vec3(0.0, uTime * 0.004, 0.0));
    float y = p.y + w * 0.55;
    float layers = 0.5 + 0.5 * sin(y * 6.5 + w * 2.5);
    float sigma = 0.6 + 2.6 * layers * layers * layers;
    float att = exp(-boxExit(p, L, uHalf) * 1.7);
    float hgt = clamp((y + uHalf.y) / (2.0 * uHalf.y), 0.0, 1.0);
    vec3 tint = mix(vec3(1.0), palette(hgt + w * 0.06), 0.62);
    vec3 hot = vec3(1.08, 0.9, 0.72);
    tint = mix(tint, hot, smoothstep(0.42, 0.9, att) * 0.85);
    acc += tint * (att * phase + 0.05) * sigma * dt * T;
    acc += hot * pow(att, 5.0) * 1.6 * dt * T;
    T *= exp(-sigma * dt * 0.8);
  }
  vec3 vol = acc * uLightColor * uGain * uIntensity + acc * vec3(0.05, 0.045, 0.07);

  float fres = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 3.0);
  float back = clamp(c * 0.5 + 0.5, 0.0, 1.0);
  float raw = step(0.5, vFace);

  // Polished outer skin.
  float edgeDist = voronoiEdge(ro);
  float edge = 1.0 - smoothstep(0.0, 0.035, edgeDist);
  vec3 alab = vec3(0.82, 0.77, 0.70);
  float ndl = max(dot(n, L), 0.0);
  vec3 surf = alab * (vec3(0.035, 0.032, 0.05) + uLightColor * ndl * 0.28) * uIntensity;
  surf = mix(surf, surf * 0.4, edge * 0.7);
  vec3 skin = surf + vol;
  skin += uLightColor * uIntensity * (fres * back * 0.35);
  skin += uLightColor * uIntensity * edge * uCrack * 1.6;

  // Freshly broken stone (inner face + cut walls): paler, chalky, wrap-lit so it doesn't go
  // black away from the light, fine grain and sparse crystalline glints. The crack glow above
  // can't apply here: every point of a cut wall sits on a cell boundary, so it lit whole walls
  // flat orange. Only the burst's flare (uCrack > 1) warms them briefly.
  float grain = snoise(ro * 34.0) * 0.5 + 0.5;
  float grainFine = snoise(ro * 97.0) * 0.5 + 0.5;
  vec3 rawAlb = vec3(0.93, 0.90, 0.85) * (0.8 + 0.2 * grain) * (0.9 + 0.1 * grainFine);
  float wrap = clamp((dot(n, L) + RAW_WRAP) / (1.0 + RAW_WRAP), 0.0, 1.0);
  vec3 rawLight = mix(vec3(dot(uLightColor, vec3(0.299, 0.587, 0.114))), uLightColor, RAW_TINT);
  vec3 rawSurf = rawAlb * (vec3(0.07, 0.068, 0.09) + rawLight * wrap * RAW_DIFFUSE) * uIntensity;
  vec3 hv = normalize(L - rd);
  float glint = smoothstep(0.72, 0.92, snoise(ro * 61.0)) * pow(max(dot(n, hv), 0.0), 6.0);
  vec3 broken = rawSurf + vol * RAW_VOLUME;
  broken += uLightColor * uIntensity * glint * RAW_GLINT;
  broken += uLightColor * uIntensity * max(uCrack - 1.0, 0.0) * 0.9;

  vec3 col = mix(skin, broken, raw);
  col *= mix(0.55, 1.0, smoothstep(0.0, 0.5, vObj.y + uHalf.y));
  col = applyMist(col, vWorld, length(vWorld - uCamPos));
  gl_FragColor = vec4(col, 1.0);
}
