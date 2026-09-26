// Displaces the ground mesh into the sea of clouds (shape in chunks/cloudsea.glsl).
varying vec3 vWorld;
varying vec3 vNormal;
varying float vMass; // normalized height within the cloud (0 gap, ~1 top of a mass)

void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  // Wide step: the mesh is coarse far away, a small step would shade its facets.
  const float e = 0.6;
  float h = seaSurfaceY(w.xz, 3);
  float hx = seaSurfaceY(w.xz + vec2(e, 0.0), 3);
  float hz = seaSurfaceY(w.xz + vec2(0.0, e), 3);
  vNormal = normalize(vec3(h - hx, e, h - hz));
  vMass = clamp((h - SEA_BASE) / max(seaAmp(w.xz), 1e-3), 0.0, 1.6);
  w.y = h;
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
