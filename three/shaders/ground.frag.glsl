varying vec3 vWorld;
uniform highp sampler3D uCloudTex;

// Cloud sea as a volume: march from the top of the layer along the view ray. Premultiplied
// alpha so thin clouds at the horizon let the mountains through.
#ifdef LOW_QUALITY
#define SEA_STEPS 16
#else
#define SEA_STEPS 28
#endif
#define SEA_SCALE 0.06       // 1 / size of the big puffs (m)
#define SEA_DETAIL_SCALE 0.34
#define SEA_COVER 0.7        // more = more cloud (deep down)
#define SEA_TOP_THR 0.72     // only the peaks of the noise reach the top
#define SEA_SHARP 1.5        // edge sharpness
#define SEA_EROSION 0.7      // how much the detail eats into the edges
#define SEA_DENSITY 3.2
#define SEA_MAX_PATH 24.0    // max march length (m) at grazing angles
#define SEA_SUN 1.5
#define SEA_SKY 1.1
#define SEA_HORIZON 0.018
#define SEA_CLEAR 14.0
#define SEA_MIST 0.5

float remap(float v, float a, float b, float c, float d){ return c + (v - a) / (b - a) * (d - c); }

vec3 seaWindOffset(){
  vec2 w = seaWind() * uTime * SEA_DRIFT;
  return vec3(w.x, seaTime() * 3.0, w.y);
}

// Density at p. depth = 0 at the top of the layer, 1 at the bottom. Near the top only the
// strongest noise makes cloud (separate puffs), lower down it all merges.
// lod fades the fine detail out when the steps are long (speckles otherwise).
float seaDensity(vec3 p, float depth, bool detail, float lod){
  vec3 q = (p - seaWindOffset()) * SEA_SCALE;
  float shape = texture(uCloudTex, q * vec3(1.0, 1.4, 1.0)).r;
  float s = clamp((shape - 0.42) / 0.46, 0.0, 1.0);
  float thr = mix(SEA_TOP_THR, 1.0 - SEA_COVER, smoothstep(0.0, 0.75, depth));
  float d = (s - thr) / max(1.0 - thr, 1e-3);
  if (detail && d > 0.0) {
    float det = texture(uCloudTex, (p - seaWindOffset() * 1.6) * SEA_DETAIL_SCALE).g;
    d -= (1.0 - clamp(d, 0.0, 1.0)) * det * SEA_EROSION * lod;
  }
  return clamp(d * SEA_SHARP, 0.0, 1.0);
}

float hgPhase(float mu, float g){
  float g2 = g * g;
  return (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * mu, 1.5) / 12.566;
}

void main(){
  vec3 v = vWorld - uCamPos;
  float dist = length(v);
  vec3 dir = v / dist;
  vec3 L = normalize(uLightDir);
  vec3 hor = skyColor(normalize(vec3(dir.x, 0.0, dir.z) + vec3(1e-5)));
  vec3 skyTop = vec3(dot(hor, vec3(0.3, 0.5, 0.2))) * vec3(0.82, 0.8, 1.05) + vec3(0.02, 0.02, 0.05);
  vec3 deep = skyTop * vec3(0.4, 0.4, 0.6);
  vec3 sunC = uLightColor;

  float topY = vWorld.y;
  float pathLen = min(SEA_THICK / max(-dir.y, 0.05), SEA_MAX_PATH);
  int steps = dist > 45.0 ? SEA_STEPS / 2 : SEA_STEPS;
  float dt = pathLen / float(steps);
  float lod = 1.0 - smoothstep(0.35, 1.1, dt);
  // per-pixel offset, fixed in time or the edges sparkle
  float jit = hash12(gl_FragCoord.xy * 1.37 + 11.0);
  float mu = dot(dir, L);
  // two lobes: strong forward glow toward the sun + some back scatter
  float phase = mix(hgPhase(mu, 0.6), hgPhase(mu, -0.2), 0.3) * 4.0 + 0.25;

  vec3 col = vec3(0.0);
  float T = 1.0;
  for (int i = 0; i < SEA_STEPS; i++){
    if (i >= steps || T < 0.03) break;
    vec3 p = vWorld + dir * ((float(i) + jit) * dt);
    float depth = clamp((topY - p.y) / SEA_THICK, 0.0, 1.0);
    float d = seaDensity(p, depth, true, lod);
    if (d <= 0.0) continue;
#ifdef LOW_QUALITY
    float lightT = exp(-d * 1.5);
#else
    // light from the sun: how much cloud between here and the sun
    vec3 pl1 = p + L * 0.5;
    vec3 pl2 = p + L * 1.4;
    float dl = seaDensity(pl1, clamp((topY - pl1.y) / SEA_THICK, 0.0, 1.0), false, 0.0) * 0.5
             + seaDensity(pl2, clamp((topY - pl2.y) / SEA_THICK, 0.0, 1.0), false, 0.0) * 0.9;
    float lightT = exp(-dl * 2.2);
#endif
    float powder = 1.0 - exp(-d * 4.0);
    vec3 sunLight = sunC * lightT * phase * mix(0.6, 1.0, powder) * SEA_SUN;
    // sky light: tops get it, the inside and the gaps much less
    vec3 skyLight = mix(skyTop, deep, smoothstep(0.0, 0.7, depth)) * SEA_SKY * mix(0.55, 1.0, powder);
    float sigma = d * SEA_DENSITY;
    float stepT = exp(-sigma * dt);
    col += T * (1.0 - stepT) * (sunLight + skyLight) * vec3(0.98, 0.95, 0.98);
    T *= stepT;
  }
  // rays that go through the whole layer end on the dark bottom, grazing ones stay see-through
  if (SEA_THICK / max(-dir.y, 0.05) <= SEA_MAX_PATH) {
    col += T * deep * SEA_SKY * 0.85;
    T = 0.0;
  }
  float alpha = 1.0 - T;
  col *= 0.35 + 0.65 * uIntensity;

  // light from the stone + its shadow
  vec2 ld = normalize(uLightDir.xz + vec2(1e-5));
  float r = length(vWorld.xz + ld * 0.9);
  float spill = exp(-r * 1.3) * 0.55 + exp(-r * 0.45) * 0.08;
  col += uLightColor * spill * uIntensity * 0.6 * alpha;
  vec2 sp = vWorld.xz + ld * 0.3;
  float sr = length(sp);
  float wide = exp(-pow(sr / mix(0.8, 1.9, uStoneOpen), 2.0) * 2.2) * mix(0.55, 0.25, uStoneOpen);
  float core = exp(-sr * sr * 30.0) * 0.45 * (1.0 - uStoneOpen);
  col *= 1.0 - clamp(wide + core, 0.0, 0.8) * (0.4 + 0.6 * uIntensity);

  // fade to the horizon (premultiplied, so scale the haze by alpha)
  vec3 haze = seaHazeColor(dir);
  float far = smoothstep(0.0, 1.0, 1.0 - exp(-max(dist - SEA_CLEAR, 0.0) * SEA_HORIZON));
  col = mix(col, haze * alpha, far);
  vec3 misted = applyMist(col / max(alpha, 1e-3), vWorld, dist) * alpha;
  col = mix(col, misted, SEA_MIST);
  gl_FragColor = vec4(col, alpha);
}
