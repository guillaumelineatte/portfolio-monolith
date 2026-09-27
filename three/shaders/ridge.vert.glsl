// A mountain range as a strip of terrain. Local x runs along the range, local y across it.
uniform float uSeed;
uniform float uFreq;
uniform float uRidgeHeight;
uniform float uTop;    // crest base height
uniform float uBase;   // height of the edges (hidden under the clouds)
uniform float uZ;      // world z of the crest line
uniform float uDepthSpan; // strip depth D
uniform float uRough;  // gully depth
varying vec3 vWorld;
varying vec3 vNormal;
varying float vHeight01;
varying float vGully; // 0 in a gully, 1 on a ridge

// ridged noise for sharp peaks instead of round bumps
float crestNoise(float x){
  float n = snoise(vec3(x * uFreq, uSeed, 0.0));
  float r1 = 1.0 - abs(snoise(vec3(x * uFreq * 2.3 + 12.3, uSeed + 4.0, 0.0)));
  float r2 = 1.0 - abs(snoise(vec3(x * uFreq * 6.1 + 3.7, uSeed + 8.0, 0.0)));
  float n4 = snoise(vec3(x * uFreq * 23.0 - 5.1, uSeed + 11.0, 0.0)) * 0.04;
  return n * 0.75 + (r1 * r1 - 0.45) * 0.7 + (r2 * r2 - 0.45) * 0.2 * r1 + n4;
}
// profile: up to the crest at 0.62, then down more gently
float profile(float s){
  float up = smoothstep(0.0, 0.62, s);
  float down = 1.0 - smoothstep(0.62, 1.0, s) * 0.7;
  return pow(up, 1.7) * down;
}
// gullies down the slopes
float gullies(float x, float s){
  float r1 = 1.0 - abs(snoise(vec3(x * 0.07, s * 2.2, uSeed * 3.0)));
  float r2 = 1.0 - abs(snoise(vec3(x * 0.19, s * 5.0, uSeed * 5.0)));
  return r1 * r1 * 0.7 + r2 * r2 * 0.3;
}
// crest only depends on x, passed in so it can be reused
float heightAt(float x, float s, float crest){
  float p = profile(s);
  return mix(uBase, crest, p) + (gullies(x, s) - 0.5) * uRough * p * (1.0 - 0.6 * p);
}

void main(){
  float x = position.x;
  float s = position.y / uDepthSpan + 0.5; // 0 front, 1 back
  float ex = 0.6;
  float es = 0.6 / uDepthSpan;
  float crest = uTop + crestNoise(x) * uRidgeHeight;
  float h = heightAt(x, s, crest);
  // normal from finite differences
  float hx = heightAt(x + ex, s, uTop + crestNoise(x + ex) * uRidgeHeight);
  float hs = heightAt(x, s + es, crest);
  vec3 tx = vec3(ex, hx - h, 0.0);
  vec3 tz = vec3(0.0, hs - h, -0.6); // +s = away from the camera
  // careful with the order, tz x tx points into the ground
  vNormal = normalize(cross(tx, tz));
  float zCrest = uZ;
  vec3 wp = vec3(x, h, zCrest - (s - 0.62) * uDepthSpan);
  vWorld = wp;
  vHeight01 = clamp((h - uBase) / max(uTop + uRidgeHeight - uBase, 1e-3), 0.0, 1.0);
  vGully = gullies(x, s);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
