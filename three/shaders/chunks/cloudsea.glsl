// Sea of clouds under the stone (it used to be a flat, misty desert floor, which read as a flat
// cloud layer anyway). Shared by ground.vert.glsl (shape), ground.frag.glsl (relief, thickness)
// and card.frag.glsl (the mist sheets fade out where they meet it).
//
// The mesh only carries the big masses (parallax, horizon line). The cloud texture itself is a
// soft density field shaded like the sky clouds, in two layers with parallax (seaDeck below).
// Surface-bump approaches were tried for the billows (|noise| creases, spherical caps, Gaussian
// balls): from this low camera they all read as sand, water or geometric shapes. Don't go back.
#define SEA_BASE -0.2
#define SEA_NEAR_AMP 0.35
#define SEA_FAR_AMP 2.4
#define SEA_SCALE 0.2
#define SEA_DRIFT 0.06

vec2 seaWind(){ return normalize(vec2(0.8, 0.6)); }
vec2 seaCoord(vec2 p){ return p * SEA_SCALE - seaWind() * uTime * SEA_DRIFT * SEA_SCALE; }
float seaTime(){ return uTime * 0.008; }

// 0 in the gaps between masses, 1 inside a mass.
float seaMass(vec2 q, float t){
  vec2 w = vec2(snoise(vec3(q * 0.18, 5.0 + t)), snoise(vec3(q * 0.18 + 4.1, 9.0 + t)));
  // Wide ramp: masses swell and taper instead of rising into flat-topped mesas.
  return smoothstep(-0.4, 0.95, snoise(vec3(q * 0.3 + w * 0.9, t * 0.5)));
}
float seaFbm(vec2 q, float t, int oct){
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++){
    if (i >= oct) break;
    s += a * snoise(vec3(q, t * (1.0 + float(i)) + float(i) * 3.1));
    q = mat2(0.8, -0.6, 0.6, 0.8) * q * 2.03 + vec2(1.7, -2.3);
    a *= 0.5;
  }
  return s;
}
// Height above SEA_BASE before the distance amplitude: ~0 in gaps, up to ~1.4 on towering masses.
float seaShape(vec2 p, int oct){
  vec2 q = seaCoord(p);
  float t = seaTime();
  float m = seaMass(q, t);
  return m * (0.35 + 0.5 * (seaFbm(q, t, oct) * 0.5 + 0.5)) + m * m * 0.45;
}
float seaAmp(vec2 p){
  float r = length(p);
  // Low under the stone, and dipping around the camera wherever it is (the About pose sits at
  // y 0.95, and the clouds drift), so no cloud ever passes through the lens.
  float camClear = smoothstep(1.5, 4.5, distance(p, uCamPos.xz));
  return mix(SEA_NEAR_AMP, SEA_FAR_AMP, smoothstep(9.0, 45.0, r)) * mix(0.3, 1.0, smoothstep(0.5, 3.0, r)) * camClear;
}
float seaSurfaceY(vec2 p, int oct){ return SEA_BASE + seaShape(p, oct) * seaAmp(p); }

// Colour the cloud sea dissolves into far away, and that mountain feet sink into: the horizon
// sky, lifted and slightly cooled (the top of a cloud deck seen at a grazing angle). Shared so
// the two meet without a seam.
vec3 seaHazeColor(vec3 dir){
  vec3 hor = skyColor(normalize(vec3(dir.x, 0.0, dir.z) + vec3(1e-5)));
  return hor * vec3(1.05, 1.0, 1.08) + vec3(0.015, 0.012, 0.02) * uIntensity;
}

// Average colour of the deck itself (what ground.frag.glsl shades up close), for things that
// sink into it: the mountain feet start from this, not from the pink horizon haze, so there's no
// seam where they meet the deck.
vec3 seaDeckTint(vec3 dir){
  vec3 hor = skyColor(normalize(vec3(dir.x, 0.0, dir.z) + vec3(1e-5)));
  vec3 skyTop = vec3(dot(hor, vec3(0.3, 0.5, 0.2))) * vec3(0.82, 0.8, 1.05) + vec3(0.02, 0.02, 0.05);
  return (uLightColor * 0.4 + skyTop * 0.9) * vec3(0.9, 0.88, 0.97) * (0.35 + 0.65 * uIntensity);
}

// Cloud-deck density (0..1) at a point of the deck, soft thresholded like the sky layer. `oct` is
// cut with distance so it never shimmers.
#define SEA_DECK_SCALE 0.14
#define SEA_DECK_COVER 0.62
#define SEA_DECK_SOFT 1.5
float seaDeck(vec2 p, int oct){
  vec2 wind = seaWind();
  vec2 q = (p - wind * uTime * SEA_DRIFT) * SEA_DECK_SCALE;
  q = vec2(dot(q, wind) * 0.75, dot(q, vec2(-wind.y, wind.x)));
  float t = seaTime() * 2.0;
  vec2 w = vec2(snoise(vec3(q * 0.35, t)), snoise(vec3(q * 0.35 + 7.3, t + 2.1)));
  float n = seaFbm(q + w * 0.7, t, oct) * 0.5 + 0.5;
  return clamp((n - (1.0 - SEA_DECK_COVER)) / SEA_DECK_COVER * SEA_DECK_SOFT, 0.0, 1.0);
}
