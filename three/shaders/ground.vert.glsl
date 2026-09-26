// Desert floor: long transverse dunes (gentle windward slope, steep lee face), perpendicular to
// the same wind as the sand ripples in ground.frag.glsl. Flat within DUNE_CLEAR_R of the origin
// so the stone's base, its contact shadow and every camera pose's sightline to it stay clear.
varying vec3 vWorld;
varying vec3 vNormal;

#define DUNE_HEIGHT 1.3
#define DUNE_CLEAR_R 12.0
#define DUNE_FULL_R 30.0

float duneH(vec2 p){
  float amp = smoothstep(DUNE_CLEAR_R, DUNE_FULL_R, length(p)) * DUNE_HEIGHT;
  if (amp <= 0.0) return 0.0;
  vec2 wind = normalize(vec2(0.8, 0.6));
  float along = dot(p, wind);
  float across = dot(p, vec2(-wind.y, wind.x));
  float warp = snoise(vec3(p * 0.03, 1.3)) * 7.0;
  float saw = fract((along + warp) * 0.16);
  float prof = smoothstep(0.0, 0.78, saw) * (1.0 - smoothstep(0.78, 1.0, saw));
  // Crest height varies along each dune (and the warp noise doubles as broad swells).
  float crestVar = snoise(vec3(across * 0.05, along * 0.02, 4.0)) * 0.5 + 0.5;
  return amp * (prof * (0.45 + 0.55 * crestVar) + warp * 0.03);
}

void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  const float e = 0.4;
  float h = duneH(w.xz);
  float hx = duneH(w.xz + vec2(e, 0.0));
  float hz = duneH(w.xz + vec2(0.0, e));
  vNormal = normalize(vec3(h - hx, e, h - hz));
  w.y += h;
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
