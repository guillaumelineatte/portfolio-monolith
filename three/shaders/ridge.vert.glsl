// Mountain range as a real terrain strip (was a vertical card with a noisy top edge). The plane's
// local x runs along the range, local y across it (front edge toward the camera at -D/2). The
// crest follows the same noise profile the card's silhouette used, so framing barely changes.
uniform float uSeed;
uniform float uFreq;
uniform float uRidgeHeight;
uniform float uTop;    // crest base height (the card's old top edge)
uniform float uBase;   // height of the strip's edges (below the ground, hidden)
uniform float uZ;      // world z of the crest line
uniform float uDepthSpan; // strip depth D
uniform float uRough;  // ridged gully relief on the slopes
varying vec3 vWorld;
varying vec3 vNormal;
varying float vHeight01;
varying float vGully; // 0 in a gully, 1 on a spur (ambient occlusion in the fragment shader)

float crestNoise(float x){
  float n = snoise(vec3(x * uFreq, uSeed, 0.0));
  float n2 = snoise(vec3(x * uFreq * 2.6 + 12.3, uSeed + 4.0, 0.0)) * 0.45;
  float n3 = snoise(vec3(x * uFreq * 9.0 + 3.7, uSeed + 8.0, 0.0)) * 0.12;
  float n4 = snoise(vec3(x * uFreq * 23.0 - 5.1, uSeed + 11.0, 0.0)) * 0.04;
  return n + n2 + n3 + n4;
}
// Cross-section: rises from the front edge to the crest (at s = 0.62), then drops more gently.
float profile(float s){
  float up = smoothstep(0.0, 0.62, s);
  float down = 1.0 - smoothstep(0.62, 1.0, s) * 0.7;
  return pow(up, 1.7) * down;
}
// Ridged noise stretched across the range: spurs and gullies running down the slopes.
float gullies(float x, float s){
  float r1 = 1.0 - abs(snoise(vec3(x * 0.07, s * 2.2, uSeed * 3.0)));
  float r2 = 1.0 - abs(snoise(vec3(x * 0.19, s * 5.0, uSeed * 5.0)));
  return r1 * r1 * 0.7 + r2 * r2 * 0.3;
}
// `crest` passed in: it only depends on x, so the finite differences below reuse it.
float heightAt(float x, float s, float crest){
  float p = profile(s);
  return mix(uBase, crest, p) + (gullies(x, s) - 0.5) * uRough * p * (1.0 - 0.6 * p);
}

void main(){
  float x = position.x;
  float s = position.y / uDepthSpan + 0.5; // 0 front edge, 1 back edge
  float ex = 0.6;
  float es = 0.6 / uDepthSpan;
  float crest = uTop + crestNoise(x) * uRidgeHeight;
  float h = heightAt(x, s, crest);
  // Normal from finite differences, in world units.
  float hx = heightAt(x + ex, s, uTop + crestNoise(x + ex) * uRidgeHeight);
  float hs = heightAt(x, s + es, crest);
  vec3 tx = vec3(ex, hx - h, 0.0);
  vec3 tz = vec3(0.0, hs - h, -0.6); // +s goes away from the camera (-z)
  vNormal = normalize(cross(tz, tx));
  float zCrest = uZ;
  vec3 wp = vec3(x, h, zCrest - (s - 0.62) * uDepthSpan);
  vWorld = wp;
  vHeight01 = clamp((h - uBase) / max(uTop + uRidgeHeight - uBase, 1e-3), 0.0, 1.0);
  vGully = gullies(x, s);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
