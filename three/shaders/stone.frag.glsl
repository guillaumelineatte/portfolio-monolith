uniform vec3 uCamObj; uniform vec3 uLightObj; uniform vec3 uHalf; uniform float uGain;
uniform int uSteps;
uniform float uCrack;
uniform vec2 uSeeds[32];
uniform int uSeedCount;
varying vec3 vObj; varying vec3 vNrm; varying vec3 vWorld;
varying vec3 vBoundsMin; varying vec3 vBoundsMax;

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
  float edgeDist = voronoiEdge(ro);
  float edge = 1.0 - smoothstep(0.0, 0.035, edgeDist);

  vec3 alab = vec3(0.82, 0.77, 0.70);
  float ndl = max(dot(n, L), 0.0);
  vec3 surf = alab * (vec3(0.035, 0.032, 0.05) + uLightColor * ndl * 0.28) * uIntensity;
  surf = mix(surf, surf * 0.4, edge * 0.7);

  float back = clamp(c * 0.5 + 0.5, 0.0, 1.0);
  vec3 col = surf + vol;
  col += uLightColor * uIntensity * (fres * back * 0.35);
  col += uLightColor * uIntensity * edge * uCrack * 1.6;
  col *= mix(0.55, 1.0, smoothstep(0.0, 0.5, vObj.y + uHalf.y));
  col = applyMist(col, vWorld, length(vWorld - uCamPos));
  gl_FragColor = vec4(col, 1.0);
}
