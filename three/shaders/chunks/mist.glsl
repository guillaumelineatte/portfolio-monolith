vec3 mistTint(){ return mix(vec3(0.42, 0.27, 0.27), uLightColor * 0.8, 0.22) * 0.5 * (0.3 + 0.7 * uIntensity); }
// Haze colour by viewing direction, like real dusk in-scattering: warm and bright toward the sun
// (forward scattering), a cooler violet-grey everywhere else. Replaces a single pink tint that
// washed stone, hills and ground into the same colour.
vec3 mistTintDir(vec3 dir){
  float toSun = pow(max(dot(dir, uSunDir), 0.0), 3.0);
  vec3 cool = vec3(0.31, 0.27, 0.36);
  vec3 warm = mix(vec3(0.46, 0.29, 0.26), uLightColor * 0.8, 0.3);
  return mix(cool, warm, 0.2 + 0.8 * toSun) * 0.5 * (0.3 + 0.7 * uIntensity);
}
vec3 applyMist(vec3 col, vec3 wp, float dist){
  float hf = exp(-max(wp.y, 0.0) * 1.5);
  float n = snoise(vec3(wp.xz * 0.22 + vec2(uTime * 0.02, uTime * 0.011), uTime * 0.015)) * 0.5 + 0.5;
  float a = (1.0 - exp(-dist * 0.055)) * hf * mix(0.45, 1.0, n) * uMist;
  return mix(col, mistTintDir((wp - uCamPos) / max(dist, 1e-4)), clamp(a, 0.0, 0.85));
}
