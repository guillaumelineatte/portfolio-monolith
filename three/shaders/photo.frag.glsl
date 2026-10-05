uniform sampler2D uTexA;
uniform sampler2D uTexB;
uniform float uMix;
uniform float uReveal;
varying vec2 vUv;
varying vec3 vWorld;

// soft edge, in plane heights: corner radius, fade width, wobble
#define EDGE_RADIUS 0.14
#define EDGE_FEATHER 0.12
#define EDGE_WOBBLE 0.025

// crop the image to fill the plane without stretching it (like object-fit: cover)
vec2 coverUv(vec2 uv, vec2 texSize){
  float ia = texSize.x / max(texSize.y, 1.0);
  vec2 s = ia > PLANE_ASPECT ? vec2(PLANE_ASPECT / ia, 1.0) : vec2(1.0, ia / PLANE_ASPECT);
  return (uv - 0.5) * s + 0.5;
}

float sdRoundBox(vec2 p, vec2 b, float r){
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main(){
  vec3 texA = texture2D(uTexA, coverUv(vUv, vec2(textureSize(uTexA, 0)))).rgb;
  vec3 texB = texture2D(uTexB, coverUv(vUv, vec2(textureSize(uTexB, 0)))).rgb;
  vec3 tex = mix(texA, texB, uMix);

  vec2 c = vUv - 0.5;
  float vign = 1.0 - smoothstep(0.32, 0.5, length(c));

  // shrink by the wobble so the fade ends before the plane edge
  vec2 p = c * vec2(PLANE_ASPECT, 1.0);
  float d = sdRoundBox(p, vec2(PLANE_ASPECT, 1.0) * 0.5 - EDGE_WOBBLE, EDGE_RADIUS);
  d += snoise(vec3(p * 3.0, uTime * 0.04)) * EDGE_WOBBLE;
  float mask = 1.0 - smoothstep(-EDGE_FEATHER, 0.0, d);

  vec3 col = tex * mix(0.55, 1.0, uIntensity);
  col = mix(col, col * uLightColor * 1.5, 0.22);
  col += uLightColor * (1.0 - vign) * 0.35 * uIntensity;
  col = applyMist(col, vWorld, length(vWorld - uCamPos));

  float alpha = uReveal * mask * mix(0.85, 1.0, vign);
  // don't write depth where the photo is invisible
  if (alpha < 0.02) discard;
  gl_FragColor = vec4(col, alpha);
}
