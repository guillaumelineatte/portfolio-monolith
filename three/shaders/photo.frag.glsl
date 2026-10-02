uniform sampler2D uTexA;
uniform sampler2D uTexB;
uniform float uMix;
uniform float uReveal;
varying vec2 vUv;
varying vec3 vWorld;

// crop the image to fill the plane without stretching it (like object-fit: cover)
vec2 coverUv(vec2 uv, vec2 texSize){
  float ia = texSize.x / max(texSize.y, 1.0);
  vec2 s = ia > PLANE_ASPECT ? vec2(PLANE_ASPECT / ia, 1.0) : vec2(1.0, ia / PLANE_ASPECT);
  return (uv - 0.5) * s + 0.5;
}

void main(){
  vec3 texA = texture2D(uTexA, coverUv(vUv, vec2(textureSize(uTexA, 0)))).rgb;
  vec3 texB = texture2D(uTexB, coverUv(vUv, vec2(textureSize(uTexB, 0)))).rgb;
  vec3 tex = mix(texA, texB, uMix);

  vec2 c = vUv - 0.5;
  float vign = 1.0 - smoothstep(0.32, 0.5, length(c));

  vec3 col = tex * mix(0.55, 1.0, uIntensity);
  col = mix(col, col * uLightColor * 1.5, 0.22);
  col += uLightColor * (1.0 - vign) * 0.35 * uIntensity;
  col = applyMist(col, vWorld, length(vWorld - uCamPos));

  float alpha = uReveal * mix(0.65, 1.0, vign);
  // don't write depth where the photo is invisible
  if (alpha < 0.02) discard;
  gl_FragColor = vec4(col, alpha);
}
