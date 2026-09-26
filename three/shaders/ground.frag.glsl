varying vec3 vWorld;
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
