vec3 mistTint(){ return mix(vec3(0.42, 0.27, 0.27), uLightColor * 0.8, 0.22) * 0.5 * (0.3 + 0.7 * uIntensity); }
vec3 applyMist(vec3 col, vec3 wp, float dist){
  float hf = exp(-max(wp.y, 0.0) * 1.5);
  float n = snoise(vec3(wp.xz * 0.22 + vec2(uTime * 0.02, uTime * 0.011), uTime * 0.015)) * 0.5 + 0.5;
  float a = (1.0 - exp(-dist * 0.055)) * hf * mix(0.45, 1.0, n) * uMist;
  return mix(col, mistTint(), clamp(a, 0.0, 0.85));
}
