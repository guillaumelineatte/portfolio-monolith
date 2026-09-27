varying vec2 vUv;
void main(){
  vec2 p = vUv - 0.5; float r = length(p) * 2.0;
  // core + wide glow behind the stone
  float k = exp(-r * r * 6.0) * 0.5 + exp(-r * 3.5) * 0.24;
  k *= 1.0 - smoothstep(0.7, 1.0, r);
  gl_FragColor = vec4(uLightColor * k * uIntensity * 0.9, 1.0);
}
