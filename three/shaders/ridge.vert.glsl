uniform float uSeed;
uniform float uFreq;
uniform float uRidgeHeight;
varying vec3 vWorld;
varying float vUvY;
void main(){
  vec3 pos = position;
  float n = snoise(vec3(pos.x * uFreq, uSeed, 0.0));
  float n2 = snoise(vec3(pos.x * uFreq * 2.6 + 12.3, uSeed + 4.0, 0.0)) * 0.45;
  // Finer, rockier crest detail on top of the two broad octaves.
  float n3 = snoise(vec3(pos.x * uFreq * 9.0 + 3.7, uSeed + 8.0, 0.0)) * 0.12;
  float n4 = snoise(vec3(pos.x * uFreq * 23.0 - 5.1, uSeed + 11.0, 0.0)) * 0.04;
  pos.y += (n + n2 + n3 + n4) * uRidgeHeight * uv.y;
  vUvY = uv.y;
  vec4 w = modelMatrix * vec4(pos, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
