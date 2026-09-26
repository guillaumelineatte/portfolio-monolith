uniform float uDepth;
uniform float uSeed;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vHeight01;
varying float vGully;

// Terrain lighting: low sun (usually behind the ranges, so faces toward the camera sit in shade),
// sky ambient from above, backlit rims on crests and spurs.
#define TERRAIN_SUN 1.2
#define TERRAIN_SKY 1.5
#define TERRAIN_RIM 0.35
// Gullies darker (sky occluded), spurs lighter; fog pooling in the lower slopes and valleys.
#define TERRAIN_AO 0.75
#define VALLEY_FOG 0.45
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

  // Rock: strata by height, patchy weathering, sandier on the lower slopes.
  float strata = snoise(vec3(vWorld.x * 0.05, vWorld.y * 1.4, uSeed)) * 0.5 + 0.5;
  float patches = snoise(vec3(vWorld.xz * 0.12, uSeed * 2.0)) * 0.5 + 0.5;
  vec3 rock = mix(vec3(0.16, 0.12, 0.13), vec3(0.24, 0.17, 0.15), strata * 0.6 + patches * 0.4);
  rock = mix(vec3(0.3, 0.22, 0.19), rock, smoothstep(0.05, 0.35, vHeight01));

  float sun = max(dot(n, L), 0.0);
  // Sky fill from above (the dusk sky is the main light on faces turned away from the low sun):
  // surfaces facing up catch it, steep faces and gullies much less, which is what reveals the
  // relief in backlight.
  vec3 skyAmb = skyColor(vec3(0.0, 0.25, -1.0)) * 1.6 * pow(max(n.y, 0.0), 1.5);
  float ao = mix(1.0 - TERRAIN_AO, 1.0 + TERRAIN_AO * 0.4, smoothstep(0.15, 0.85, vGully));
  vec3 col = rock * (uLightColor * sun * TERRAIN_SUN + skyAmb * TERRAIN_SKY * ao + vec3(0.02, 0.018, 0.026) * ao);
  float rim = pow(1.0 - max(dot(n, -dir), 0.0), 4.0) * max(dot(dir, L), 0.0);
  col += uLightColor * rim * TERRAIN_RIM;
  col *= 0.35 + 0.65 * uIntensity;

  // Aerial perspective (unchanged idea): each farther layer sinks into a paler, greyer, cooler haze.
  float hl = dot(hor, vec3(0.299, 0.587, 0.114));
  vec3 haze = mix(hor, vec3(hl) * vec3(0.8, 0.82, 0.98), 0.25 + 0.45 * uDepth);
  float low = 1.0 - vHeight01;
  float hazeAmt = clamp(0.05 + uDepth * 0.8 + low * low * VALLEY_FOG, 0.0, 0.95);
  col = mix(col, haze, hazeAmt);

  col = applyMist(col, vWorld, dist);
  gl_FragColor = vec4(col, 1.0);
}
