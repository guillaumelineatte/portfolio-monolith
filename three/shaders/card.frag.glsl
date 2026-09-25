uniform float uSeed; varying vec2 vUv; varying vec3 vWorld;
void main(){
  float t = uTime;
  float n = snoise(vec3(vUv * vec2(2.4, 1.1) + vec2(t * 0.014 + uSeed, uSeed * 1.7), t * 0.018)) * 0.5 + 0.5;
  float n2 = snoise(vec3(vUv * vec2(6.0, 2.2) + vec2(-t * 0.022, uSeed * 3.1), t * 0.03)) * 0.5 + 0.5;
  float edge = smoothstep(0.0, 0.3, vUv.x) * (1.0 - smoothstep(0.7, 1.0, vUv.x)) * smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.4, 1.0, vUv.y));
  float fade = smoothstep(2.0, 5.0, length(vWorld - uCamPos));
  float a = edge * smoothstep(0.25, 0.85, n) * mix(0.5, 1.0, n2) * 0.3 * uMist * fade * (0.4 + 0.6 * uIntensity);
  gl_FragColor = vec4(mistTint() + uLightColor * 0.06 * uIntensity, a);
}
