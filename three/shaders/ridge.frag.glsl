uniform float uDepth;
uniform float uSeed;
uniform float uTop;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vHeight01;
varying float vGully;

// Terrain lighting: low sun (usually behind the ranges, so faces toward the camera sit in shade),
// alpenglow on the high ground, cool sky fill in the shade, backlit rims on crests and spurs.
#define TERRAIN_SUN 1.3
#define TERRAIN_SKY 1.3
#define TERRAIN_RIM 0.4
// Gullies darker (sky occluded), spurs lighter; fog pooling in the lower slopes and valleys.
#define TERRAIN_AO 0.75
#define VALLEY_FOG 0.18
// Aerial perspective per unit of layer depth (uDepth 0.18 / 0.48 / 0.78).
#define AERIAL 0.6
// Fog band where the feet meet the cloud sea: deck height out there (m) and band height (m).
#define SINK_DECK 0.9
#define SINK_HEIGHT 0.9
// Snow: line relative to each range's crest base (uTop), amount. Alpenglow on the high ground.
#define SNOW_LINE 0.6
#define SNOW_AMOUNT 0.9
#define ALPENGLOW 0.45
// Fine erosion relief (per-pixel normal): what makes a range read as rock from far away.
#define DETAIL_BUMP 0.35

float erosion(vec3 p){
  // Stretched vertically: runnels and rock ribs down the slopes.
  float e = snoise(vec3(p.x * 0.45, p.y * 0.12, p.z * 0.45)) * 0.6;
#ifndef LOW_QUALITY
  e += snoise(vec3(p.x * 1.4, p.y * 0.35, p.z * 1.4)) * 0.4;
#endif
  return e;
}

void main(){
  vec3 v = vWorld - uCamPos;
  float dist = length(v);
  vec3 dir = v / max(dist, 1e-4);
  vec3 n = normalize(vNormal);
  // Far range: the haze hides this detail, skip it (uniform branch, whole draw call).
  if (uDepth < 0.6) {
    const float e = 0.15;
    float e0 = erosion(vWorld);
    vec3 g = vec3(erosion(vWorld + vec3(e, 0.0, 0.0)), erosion(vWorld + vec3(0.0, e, 0.0)), erosion(vWorld + vec3(0.0, 0.0, e))) - e0;
    g /= e;
    g -= dot(g, n) * n;
    n = normalize(n - g * DETAIL_BUMP);
  }
  vec3 L = normalize(uLightDir);
  vec3 hor = skyColor(normalize(vec3(dir.x, 0.02, dir.z)));

  // Rock: dark and slightly cool so the ranges separate from the dusk sky; strata by height,
  // patchy weathering, a bit warmer and sandier low down.
  float strata = snoise(vec3(vWorld.x * 0.05, vWorld.y * 1.4, uSeed)) * 0.5 + 0.5;
  float patches = snoise(vec3(vWorld.xz * 0.12, uSeed * 2.0)) * 0.5 + 0.5;
  vec3 rock = mix(vec3(0.085, 0.075, 0.085), vec3(0.16, 0.13, 0.125), strata * 0.6 + patches * 0.4);
  rock = mix(vec3(0.19, 0.15, 0.14), rock, smoothstep(0.05, 0.35, vHeight01));

  // Snow on the high ground: above a ragged line, on the flatter faces and in the gullies.
  float snowNoise = snoise(vec3(vWorld.x * 0.18, vWorld.y * 0.5, vWorld.z * 0.18 + uSeed)) ;
  float snowLine = uTop + SNOW_LINE + snowNoise * 1.1;
  float snow = smoothstep(snowLine - 0.5, snowLine + 0.5, vWorld.y);
  snow *= smoothstep(0.35, 0.7, n.y + (1.0 - vGully) * 0.25);
  snow *= SNOW_AMOUNT;
  vec3 alb = mix(rock, vec3(0.86, 0.86, 0.92), snow);

  // Light: the low sun on faces turned to it, plus alpenglow (the high ground stays lit, pink,
  // after the valleys have gone into shadow), and a cool blue-violet sky fill in the shade.
  float sun = max(dot(n, L), 0.0);
  float glow = smoothstep(0.35, 1.0, vHeight01) * ALPENGLOW;
  vec3 skyFill = mix(skyColor(vec3(0.0, 0.35, -1.0)), vec3(0.09, 0.09, 0.2), 0.35) * pow(max(n.y, 0.0), 1.2);
  float ao = mix(1.0 - TERRAIN_AO, 1.0 + TERRAIN_AO * 0.3, smoothstep(0.15, 0.85, vGully));
  vec3 col = alb * (uLightColor * (sun * TERRAIN_SUN + glow) + skyFill * TERRAIN_SKY * ao + vec3(0.012, 0.012, 0.03) * ao);
  float rim = pow(1.0 - max(dot(n, -dir), 0.0), 4.0) * max(dot(dir, L), 0.0);
  col += uLightColor * rim * TERRAIN_RIM;
  col *= 0.35 + 0.65 * uIntensity;

  // Aerial perspective: farther layers go paler, greyer and cooler, but stay readable.
  float hl = dot(hor, vec3(0.299, 0.587, 0.114));
  vec3 haze = mix(hor, vec3(hl) * vec3(0.8, 0.82, 0.98), 0.25 + 0.45 * uDepth);
  float low = 1.0 - vHeight01;
  float hazeAmt = clamp(0.03 + uDepth * AERIAL + low * low * VALLEY_FOG, 0.0, 0.9);
  col = mix(col, haze, hazeAmt);
  // Feet sinking into the cloud sea: a thin band right at the deck's actual height out there
  // (~1 m; the deck mesh already hides everything below it). Started at 2.2 m + 3.5 m before
  // and painted a pale veil over half the front range.
  float deck = SINK_DECK + snoise(vec3(vWorld.x * 0.06, vWorld.z * 0.06, 3.0)) * 0.5;
  float sink = 1.0 - smoothstep(deck - 0.5, deck + SINK_HEIGHT, vWorld.y);
  vec3 sinkCol = mix(seaHazeColor(dir) * (0.35 + 0.65 * uIntensity), seaDeckTint(dir), smoothstep(0.6, 1.0, sink));
  col = mix(col, sinkCol, sink * sink * (3.0 - 2.0 * sink));

  // Half the scene haze (it's already accounted for by the aerial perspective above).
  col = mix(col, applyMist(col, vWorld, dist), 0.5);
  gl_FragColor = vec4(col, 1.0);
}
