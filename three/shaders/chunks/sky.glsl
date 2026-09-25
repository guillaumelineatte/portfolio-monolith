vec3 skyColor(vec3 d){
  float hh = max(d.y, 0.0);
  vec3 zenith = vec3(0.012, 0.016, 0.045);
  vec3 upper  = vec3(0.050, 0.045, 0.110);
  vec3 lowsky = vec3(0.300, 0.150, 0.190);
  vec3 hor    = vec3(0.780, 0.420, 0.280);
  vec3 c = mix(hor, lowsky, smoothstep(0.0, 0.07, hh));
  c = mix(c, upper, smoothstep(0.05, 0.32, hh));
  c = mix(c, zenith, smoothstep(0.30, 0.95, hh));
  vec2 dx = normalize(d.xz + vec2(1e-5));
  vec2 sx = normalize(uSunDir.xz + vec2(1e-5));
  float side = dot(dx, sx) * 0.5 + 0.5;
  c *= mix(1.0, mix(0.42, 1.0, side), exp(-hh * 2.5));
  float s = max(dot(d, uSunDir), 0.0);
  c += uLightColor * (pow(s, 40.0) * 0.9 + pow(s, 6.0) * 0.35) * exp(-hh * 5.0) * (0.35 + 0.65 * uIntensity);
  return c * (0.22 + 0.78 * uIntensity);
}
