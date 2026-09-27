uniform float uDepth;
uniform float uSeed;
uniform float uTop;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vHeight01;
varying float vGully;
varying vec2 vLocal;

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
// rock relief per pixel (ribs and gullies down the slopes), finer than the mesh
#define RELIEF_HEIGHT 1.6
#define RELIEF_SCALE 0.2

float rockRelief(vec2 u, int oct){
  vec2 q = u * vec2(RELIEF_SCALE, RELIEF_SCALE * 0.45);
  float h = 0.0;
  float a = 0.55;
  for (int i = 0; i < 4; i++){
    if (i >= oct) break;
    float r = 1.0 - abs(snoise(vec3(q, uSeed * 3.1 + float(i) * 7.3)));
    h += a * r * r;
    q = mat2(0.8, -0.6, 0.6, 0.8) * q * 2.2 + vec2(3.1, -1.7);
    a *= 0.48;
  }
  return h;
}

void main(){
  vec3 v = vWorld - uCamPos;
  float dist = length(v);
  vec3 dir = v / max(dist, 1e-4);
  vec3 n = normalize(vNormal);
  // Per-pixel relief, fewer octaves on the far ranges (they're small on screen).
  int oct = uDepth < 0.3 ? 4 : (uDepth < 0.6 ? 3 : 2);
  const float e = 0.12;
  float r0 = rockRelief(vLocal, oct);
  float rx = rockRelief(vLocal + vec2(e, 0.0), oct);
  float rz = rockRelief(vLocal + vec2(0.0, e), oct);
  // local v goes away from the camera, world z toward it
  vec3 g = vec3(rx - r0, 0.0, -(rz - r0)) / e * RELIEF_HEIGHT * (uDepth < 0.6 ? 1.0 : 0.6);
  g -= dot(g, n) * n;
  n = normalize(n - g);
  float steep = 1.0 - n.y;
  vec3 L = normalize(uLightDir);
  vec3 hor = skyColor(normalize(vec3(dir.x, 0.02, dir.z)));

  // dark rock so it stands out from the sky, lighter and warmer low down
  float strata = snoise(vec3(vWorld.x * 0.05, vWorld.y * 1.4, uSeed)) * 0.5 + 0.5;
  float patches = snoise(vec3(vWorld.xz * 0.12, uSeed * 2.0)) * 0.5 + 0.5;
  vec3 rock = mix(vec3(0.085, 0.075, 0.085), vec3(0.16, 0.13, 0.125), strata * 0.6 + patches * 0.4);
  rock = mix(vec3(0.19, 0.15, 0.14), rock, smoothstep(0.05, 0.35, vHeight01));
  // cliffs a bit darker and greyer, crevices between the ribs darker still
  rock = mix(rock, vec3(0.07, 0.065, 0.075), smoothstep(0.35, 0.75, steep) * 0.6);
  rock *= mix(0.55, 1.1, smoothstep(0.15, 0.55, r0));

  // snow up high, on the flatter faces
  float snowNoise = snoise(vec3(vWorld.x * 0.18, vWorld.y * 0.5, vWorld.z * 0.18 + uSeed)) ;
  float snowLine = uTop + SNOW_LINE + snowNoise * 1.1;
  float snow = smoothstep(snowLine - 0.5, snowLine + 0.5, vWorld.y);
  // only where it can hold: gentle faces and the tops of the ribs
  snow *= smoothstep(0.45, 0.75, n.y + (1.0 - vGully) * 0.15) * smoothstep(0.1, 0.4, r0);
  snow *= SNOW_AMOUNT;
  vec3 alb = mix(rock, vec3(0.86, 0.86, 0.92), snow);

  // sun + pink light on the tops + bluish light in the shade
  float sun = max(dot(n, L), 0.0);
  float glow = smoothstep(0.35, 1.0, vHeight01) * ALPENGLOW;
  vec3 skyFill = mix(skyColor(vec3(0.0, 0.35, -1.0)), vec3(0.09, 0.09, 0.2), 0.35) * pow(max(n.y, 0.0), 1.2);
  float ao = mix(1.0 - TERRAIN_AO, 1.0 + TERRAIN_AO * 0.3, smoothstep(0.15, 0.85, vGully)) * mix(0.6, 1.0, smoothstep(0.1, 0.5, r0));
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
