varying vec3 vWorld;
// Sand ripples: spatial frequency along the wind and how much low sun they catch.
#define RIPPLE_FREQ 7.0
#define RIPPLE_LIGHT 0.8
void main(){
  vec3 v = vWorld - uCamPos; float dist = length(v); vec3 dir = v / dist;
  vec3 hor = skyColor(normalize(vec3(dir.x, 0.0, dir.z) + vec3(1e-5)));
  float n = snoise(vec3(vWorld.xz * 0.45, 1.7)) * 0.5 + 0.5;
  float n2 = snoise(vec3(vWorld.xz * 2.3, 4.1)) * 0.5 + 0.5;
  vec3 base = vec3(0.030, 0.026, 0.034) * (0.65 + 0.5 * n) * (0.85 + 0.3 * n2);
  base *= 0.35 + 0.65 * uIntensity;
  base += vec3(0.020, 0.018, 0.030) * uIntensity;
  vec2 ld = normalize(uLightDir.xz + vec2(1e-5));
  float r = length(vWorld.xz + ld * 0.9);
  float spill = exp(-r * 1.3) * 0.55 + exp(-r * 0.45) * 0.08;
  vec3 col = base + uLightColor * spill * uIntensity;
  // Wind ripples in the sand under the low sun: slopes facing the light brighter, the others in
  // shade, faded out with distance before they alias. Plus a fine grain up close.
  vec2 wind = normalize(vec2(0.8, 0.6));
  float ph = dot(vWorld.xz, wind) * RIPPLE_FREQ + snoise(vec3(vWorld.xz * 0.35, 9.0)) * 2.5;
  float ripple = cos(ph) * (0.6 + 0.4 * snoise(vec3(vWorld.xz * 0.9, 3.3)));
  float near = 1.0 - smoothstep(5.0, 16.0, dist);
  float lit = 0.35 + 0.65 * ripple * dot(wind, ld);
  col += uLightColor * uIntensity * RIPPLE_LIGHT * lit * (0.35 + 0.65 * near);
  col *= 1.0 + (hash12(floor(vWorld.xz * 70.0)) - 0.5) * 0.35 * (1.0 - smoothstep(2.0, 7.0, dist));
  // Contact shadow under the stone (its tip touches the ground at the origin), pushed away from
  // the light; spreads out and fades as the fragments open and lift away.
  vec2 sp = vWorld.xz + ld * 0.3;
  float sr = length(sp);
  float wide = exp(-pow(sr / mix(0.8, 1.9, uStoneOpen), 2.0) * 2.2) * mix(0.55, 0.25, uStoneOpen);
  float core = exp(-sr * sr * 30.0) * 0.45 * (1.0 - uStoneOpen);
  col *= 1.0 - clamp(wide + core, 0.0, 0.8) * (0.4 + 0.6 * uIntensity);
  col = mix(col, hor, 1.0 - exp(-dist * 0.06));
  col = applyMist(col, vWorld, dist);
  gl_FragColor = vec4(col, 1.0);
}
