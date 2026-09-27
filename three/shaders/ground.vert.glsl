// top of the cloud layer (chunks/cloudsea.glsl)
varying vec3 vWorld;

void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  w.y = seaTopY(w.xz);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
