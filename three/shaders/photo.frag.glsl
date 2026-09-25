uniform sampler2D uTexA;
uniform sampler2D uTexB;
uniform float uMix;
uniform float uReveal;
varying vec2 vUv;
varying vec3 vWorld;
void main(){
  vec3 texA = texture2D(uTexA, vUv).rgb;
  vec3 texB = texture2D(uTexB, vUv).rgb;
  vec3 tex = mix(texA, texB, uMix);

  vec2 c = vUv - 0.5;
  float vign = 1.0 - smoothstep(0.32, 0.5, length(c));

  vec3 col = tex * mix(0.55, 1.0, uIntensity);
  col = mix(col, col * uLightColor * 1.5, 0.22);
  col += uLightColor * (1.0 - vign) * 0.35 * uIntensity;
  col = applyMist(col, vWorld, length(vWorld - uCamPos));

  float alpha = uReveal * mix(0.65, 1.0, vign);
  gl_FragColor = vec4(col, alpha);
}
