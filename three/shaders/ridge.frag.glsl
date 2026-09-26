uniform float uDepth;
uniform float uSeed;
varying vec3 vWorld;
varying float vUvY;
void main(){
  vec3 v = vWorld - uCamPos;
  float dist = length(v);
  vec3 dir = v / max(dist, 1e-4);
  vec3 hor = skyColor(normalize(vec3(dir.x, 0.02, dir.z)));

  // Rock body: dark, slightly cool, with horizontal strata and eroded gullies, the sunward side of
  // each gully catching a little of the light.
  float strata = snoise(vec3(vWorld.x * 0.08, vWorld.y * 1.1, uSeed)) * 0.5 + 0.5;
  float gully = snoise(vec3(vWorld.x * 0.45, vWorld.y * 0.22, uSeed * 2.0));
  vec3 rock = vec3(0.085, 0.066, 0.078) * (0.75 + 0.35 * strata) * (0.85 + 0.25 * gully);
  rock += uLightColor * 0.035 * smoothstep(-0.1, 0.9, gully);
  rock *= 0.35 + 0.65 * uIntensity;

  // Aerial perspective: each farther layer sinks further into the horizon haze, which itself goes
  // paler, greyer and cooler with distance (near layers stay dark silhouettes, far ones fade out).
  float hl = dot(hor, vec3(0.299, 0.587, 0.114));
  vec3 haze = mix(hor, vec3(hl) * vec3(0.8, 0.82, 0.98), 0.25 + 0.45 * uDepth);
  float hazeAmt = clamp(0.2 + uDepth * 0.9 + (1.0 - vUvY) * 0.15, 0.0, 0.95);
  vec3 col = mix(rock, haze, hazeAmt);

  // Thin light rim along the crest (the sun is low, behind the ridges), stronger on near layers.
  col += uLightColor * smoothstep(0.965, 1.0, vUvY) * 0.18 * uIntensity * (1.0 - uDepth * 0.7);

  col = applyMist(col, vWorld, dist);
  gl_FragColor = vec4(col, 1.0);
}
