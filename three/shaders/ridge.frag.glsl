uniform float uDepth;
uniform float uSeed;
uniform float uTop;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vHeight01;
varying float vGully;

// Mountains: low sun (mostly behind them), pink light up high, cool light in the shade,
// bright rims on the crests.
#define TERRAIN_SUN 1.3
#define TERRAIN_SKY 1.3
#define TERRAIN_RIM 0.4
// gullies darker, fog in the low parts
#define TERRAIN_AO 0.75
#define VALLEY_FOG 0.18
// how much the far ranges fade
#define AERIAL 0.6
// fog where the mountains meet the clouds: height of the clouds there, band height
#define SINK_DECK 0.9
#define SINK_HEIGHT 0.9
// snow line (relative to the crest base), snow amount, pink light up high
#define SNOW_LINE 0.6
#define SNOW_AMOUNT 0.9
#define ALPENGLOW 0.45
// small erosion details
#define DETAIL_BUMP 0.35

float erosion(vec3 p){
  // stretched vertically, like runoff
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
  // not worth it on the far range
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

  // dark rock so it stands out from the sky, lighter and warmer low down
  float strata = snoise(vec3(vWorld.x * 0.05, vWorld.y * 1.4, uSeed)) * 0.5 + 0.5;
  float patches = snoise(vec3(vWorld.xz * 0.12, uSeed * 2.0)) * 0.5 + 0.5;
  vec3 rock = mix(vec3(0.085, 0.075, 0.085), vec3(0.16, 0.13, 0.125), strata * 0.6 + patches * 0.4);
  rock = mix(vec3(0.19, 0.15, 0.14), rock, smoothstep(0.05, 0.35, vHeight01));

  // snow up high, on the flatter faces
  float snowNoise = snoise(vec3(vWorld.x * 0.18, vWorld.y * 0.5, vWorld.z * 0.18 + uSeed)) ;
  float snowLine = uTop + SNOW_LINE + snowNoise * 1.1;
  float snow = smoothstep(snowLine - 0.5, snowLine + 0.5, vWorld.y);
  snow *= smoothstep(0.35, 0.7, n.y + (1.0 - vGully) * 0.25);
  snow *= SNOW_AMOUNT;
  vec3 alb = mix(rock, vec3(0.86, 0.86, 0.92), snow);

  // sun + pink light on the tops + bluish light in the shade
  float sun = max(dot(n, L), 0.0);
  float glow = smoothstep(0.35, 1.0, vHeight01) * ALPENGLOW;
  vec3 skyFill = mix(skyColor(vec3(0.0, 0.35, -1.0)), vec3(0.09, 0.09, 0.2), 0.35) * pow(max(n.y, 0.0), 1.2);
  float ao = mix(1.0 - TERRAIN_AO, 1.0 + TERRAIN_AO * 0.3, smoothstep(0.15, 0.85, vGully));
  vec3 col = alb * (uLightColor * (sun * TERRAIN_SUN + glow) + skyFill * TERRAIN_SKY * ao + vec3(0.012, 0.012, 0.03) * ao);
  float rim = pow(1.0 - max(dot(n, -dir), 0.0), 4.0) * max(dot(dir, L), 0.0);
  col += uLightColor * rim * TERRAIN_RIM;
  col *= 0.35 + 0.65 * uIntensity;

  // far ranges get paler and cooler
  float hl = dot(hor, vec3(0.299, 0.587, 0.114));
  vec3 haze = mix(hor, vec3(hl) * vec3(0.8, 0.82, 0.98), 0.25 + 0.45 * uDepth);
  float low = 1.0 - vHeight01;
  float hazeAmt = clamp(0.03 + uDepth * AERIAL + low * low * VALLEY_FOG, 0.0, 0.9);
  col = mix(col, haze, hazeAmt);
  // thin fog band where they go into the clouds. Keep it low and thin, too high = white veil
  float deck = SINK_DECK + snoise(vec3(vWorld.x * 0.06, vWorld.z * 0.06, 3.0)) * 0.5;
  float sink = 1.0 - smoothstep(deck - 0.5, deck + SINK_HEIGHT, vWorld.y);
  vec3 sinkCol = mix(seaHazeColor(dir) * (0.35 + 0.65 * uIntensity), seaDeckTint(dir), smoothstep(0.6, 1.0, sink));
  col = mix(col, sinkCol, sink * sink * (3.0 - 2.0 * sink));

  // half the scene haze, the fade above already does most of it
  col = mix(col, applyMist(col, vWorld, dist), 0.5);
  gl_FragColor = vec4(col, 1.0);
}
