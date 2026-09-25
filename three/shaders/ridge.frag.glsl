uniform float uDepth;
varying vec3 vWorld;
varying float vUvY;
void main(){
  vec3 v = vWorld - uCamPos;
  float dist = length(v);
  vec3 dir = v / max(dist, 1e-4);
  vec3 hor = skyColor(normalize(vec3(dir.x, 0.02, dir.z)));
  vec3 base = mix(vec3(0.045, 0.032, 0.038), vec3(0.16, 0.09, 0.08), 0.4) * (0.35 + 0.65 * uIntensity);
  vec3 col = mix(base, hor, clamp(uDepth * 0.65 + vUvY * 0.18, 0.0, 0.92));
  col = applyMist(col, vWorld, dist);
  gl_FragColor = vec4(col, 1.0);
}
