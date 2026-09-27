varying vec3 vWorld;
varying vec3 vNormal;
varying float vMass;

// Cloud sea, shaded like the sky clouds, plus a second layer underneath seen through the gaps.
#define SEA_SUN 0.95
#define SEA_SKY 1.0
#define SEA_GLOW 0.8
// top layer opacity, shadow sample distance, depth of the second layer
#define SEA_DENSITY 2.6
#define SEA_SHADOW_OFF 1.2
#define SEA_LAYER_GAP 1.8
#define SEA_HORIZON 0.018
// distance before the horizon fade starts
#define SEA_CLEAR 14.0
// how soft the edges seen from the side are
#define SEA_EDGE_SOFT 0.75
#define SEA_MIST 0.5

void main(){
  vec3 v = vWorld - uCamPos; float dist = length(v); vec3 dir = v / dist;
  vec3 hor = skyColor(normalize(vec3(dir.x, 0.0, dir.z) + vec3(1e-5)));
  vec3 L = normalize(uLightDir);
  vec3 nGeo = normalize(vNormal);
  float toSun = max(dot(dir, L), 0.0);
  float mu = dot(dir, L);
  float phase = 0.35 + 3.2 * (1.0 - 0.3) * (1.0 - 0.09) / pow(1.0 + 0.09 - 0.6 * mu, 1.5) / 12.566 * 4.0;
  vec3 sunC = uLightColor;
  // cool sky light (warm shadows made it look like sand)
  vec3 skyTop = vec3(dot(hor, vec3(0.3, 0.5, 0.2))) * vec3(0.82, 0.8, 1.05) + vec3(0.02, 0.02, 0.05);
  vec2 sunXZ = normalize(L.xz + vec2(1e-5));
  int oct = dist < 14.0 ? 5 : (dist < 35.0 ? 4 : 3);

  // top layer
  float d1 = seaDeck(vWorld.xz, oct);
  float dL = seaDeck(vWorld.xz + sunXZ * SEA_SHADOW_OFF, 3);
  float shade = exp(-dL * 2.4);
  // soft shading of the big masses
  float massLit = smoothstep(-0.4, 0.9, dot(nGeo, L));
  float thin = 1.0 - d1;
  vec3 lit1 = sunC * shade * phase * (0.5 + 0.7 * thin) * SEA_SUN * mix(0.6, 1.0, massLit);
  vec3 amb1 = skyTop * SEA_SKY * (0.55 + 0.45 * thin) * mix(0.8, 1.1, smoothstep(0.1, 1.0, vMass));
  vec3 cloud1 = (lit1 + amb1) * vec3(0.98, 0.94, 0.97);

  // lower layer through the gaps, darker and cooler
  vec2 off = dir.xz / max(-dir.y, 0.12) * SEA_LAYER_GAP;
  float d2 = seaDeck(vWorld.xz + off + vec2(13.1, 7.7), 3);
  vec3 cloud2 = (sunC * phase * 0.35 * SEA_SUN + skyTop * SEA_SKY * 0.6) * vec3(0.8, 0.8, 0.95);
  vec3 deep = skyTop * vec3(0.42, 0.42, 0.62);
  vec3 col = mix(deep, cloud2, 1.0 - exp(-d2 * 2.2));
  col = mix(col, cloud1, 1.0 - exp(-d1 * SEA_DENSITY));
  // bright edges toward the sun
  col += sunC * pow(toSun, 5.0) * SEA_GLOW * d1 * thin * 2.0;
  col *= 0.35 + 0.65 * uIntensity;

  // light from the stone + its shadow
  vec2 ld = normalize(uLightDir.xz + vec2(1e-5));
  float r = length(vWorld.xz + ld * 0.9);
  float spill = exp(-r * 1.3) * 0.55 + exp(-r * 0.45) * 0.08;
  col += uLightColor * spill * uIntensity * 0.6;
  vec2 sp = vWorld.xz + ld * 0.3;
  float sr = length(sp);
  float wide = exp(-pow(sr / mix(0.8, 1.9, uStoneOpen), 2.0) * 2.2) * mix(0.55, 0.25, uStoneOpen);
  float core = exp(-sr * sr * 30.0) * 0.45 * (1.0 - uStoneOpen);
  col *= 1.0 - clamp(wide + core, 0.0, 0.8) * (0.4 + 0.6 * uIntensity);

  // soften the outlines of the masses, they looked sculpted
  vec3 haze = seaHazeColor(dir);
  // only real silhouettes, the camera is low so everything is at a grazing angle
  float edgeOn = 1.0 - smoothstep(0.0, 0.1, dot(nGeo, -dir));
  col = mix(col, haze, edgeOn * SEA_EDGE_SOFT);
  // long fade to the horizon so the end of the mesh never shows
  col = mix(col, haze, smoothstep(0.0, 1.0, 1.0 - exp(-max(dist - SEA_CLEAR, 0.0) * SEA_HORIZON)));
  // half the haze, more flattens everything
  col = mix(col, applyMist(col, vWorld, dist), SEA_MIST);
  gl_FragColor = vec4(col, 1.0);
}
