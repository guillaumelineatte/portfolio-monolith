varying vec3 vDir;

// Visible sky only (not skyColor(), which the stone's reflection, the ridges and the haze also
// use): a volumetric-looking cloud layer and faint stars.
//
// Clouds: the view ray is intersected with a flat layer at CLOUD_ALT, so cells shrink and pile up
// toward the horizon like a real deck. Shape = domain-warped fbm stretched along the wind,
// thresholded by CLOUD_COVER. Light = low sun from the side (warm undersides, forward-scattering
// silver lining toward it, self-shadowing from a second density sample shifted sunward) plus
// cooler sky light on top; far clouds dissolve into the horizon haze.
#define CLOUD_ALT 1.0
#define CLOUD_SCALE 0.55
#define CLOUD_COVER 0.52
#define CLOUD_DENSITY 2.2
#define CLOUD_SPEED 0.012
#define CLOUD_SUN 1.35
#define CLOUD_SKY 0.9
#define CLOUD_HORIZON_FADE 0.045
// Edge sharpness, and how much fine noise eats into the thin edges.
#define CLOUD_CONTRAST 2.6
#define CLOUD_EROSION 0.7
#define STAR_AMOUNT 0.7

#ifdef LOW_QUALITY
#define CLOUD_OCTAVES 4
#else
#define CLOUD_OCTAVES 5
#endif

float fbm(vec3 p, int octaves){
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < CLOUD_OCTAVES; i++){
    if (i >= octaves) break;
    s += a * snoise(p);
    p = p * 2.07 + vec3(1.7, -3.1, 2.3);
    a *= 0.5;
  }
  return s;
}

// Coverage-thresholded density, 0..1. `q` is the position on the cloud layer.
float cloudDensity(vec2 q, float t, int octaves){
  vec2 warp = vec2(snoise(vec3(q * 0.35, t * 0.3)), snoise(vec3(q * 0.35 + 7.3, t * 0.3 + 2.1)));
  float n = fbm(vec3(q + warp * 0.6, t), octaves) * 0.5 + 0.5;
  float dens = clamp((n - (1.0 - CLOUD_COVER)) / CLOUD_COVER * CLOUD_CONTRAST, 0.0, 1.0);
  // Erode the thin edges with fine noise: wispy, broken borders instead of cotton-soft blobs.
  // Kept on low-end too (one noise): without it the portrait camera's big overhead clouds read
  // as smoke. Skipped for the self-shadow sample.
  if (octaves > 3) {
    float fine = snoise(vec3(q * 7.0, t * 2.0)) * 0.5 + 0.5;
    dens = clamp(dens - (1.0 - dens) * fine * CLOUD_EROSION, 0.0, 1.0);
  }
  return dens;
}

float hg(float mu, float g){
  float g2 = g * g;
  return (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * mu, 1.5) / 12.566;
}

void main(){
  vec3 d = normalize(vDir);
  vec3 col = skyColor(d);
  float hh = max(d.y, 0.0);
  float cloudA = 0.0;

  if (d.y > 0.0) {
    // Distance along the ray to the layer; a small floor keeps the horizon from blowing up.
    float tRay = CLOUD_ALT / (d.y + 0.035);
    vec2 wind = normalize(vec2(0.8, 0.6));
    vec2 q = d.xz * tRay * CLOUD_SCALE;
    // Stretch along the wind (stratiform decks), drift with it, evolve slowly.
    q = vec2(dot(q, wind) * 0.55, dot(q, vec2(-wind.y, wind.x)));
    q.x -= uTime * CLOUD_SPEED * 6.0;
    float t = uTime * CLOUD_SPEED * 0.4;
    float dens = cloudDensity(q, t, CLOUD_OCTAVES);

    if (dens > 0.001) {
      vec2 sunQ = normalize(vec2(dot(uSunDir.xz, wind), dot(uSunDir.xz, vec2(-wind.y, wind.x))) + 1e-5);
#ifdef LOW_QUALITY
      float shade = 1.0 - dens * 0.5;
#else
      // Self-shadowing: how much cloud lies between this point and the sun.
      float densL = cloudDensity(q + sunQ * 0.18, t, 3);
      float shade = exp(-densL * 2.6);
#endif
      float mu = dot(d, uSunDir);
      float phase = hg(mu, 0.55) * 7.0 + 0.35;
      vec3 sunCol = uLightColor * mix(vec3(1.0), vec3(1.15, 0.85, 0.7), 0.5);
      vec3 skyTop = skyColor(vec3(0.0, 0.6, -0.8));
      vec3 skyLow = skyColor(normalize(vec3(d.x, 0.04, d.z)));
      // Thin edges let the sun through (silver lining), thick cores go dark and take the sky tint.
      float thin = 1.0 - dens;
      vec3 lit = sunCol * shade * phase * (0.45 + 0.8 * thin) * CLOUD_SUN;
      // Dense cores: the sky light barely gets in either (darker, cooler bellies).
      vec3 amb = mix(skyLow, skyTop, 0.5) * CLOUD_SKY * (0.35 + 0.65 * thin);
      vec3 cloudCol = (lit + amb) * (0.22 + 0.78 * uIntensity);
      // Far clouds dissolve into the horizon haze.
      float haze = 1.0 - exp(-tRay * CLOUD_HORIZON_FADE);
      cloudCol = mix(cloudCol, col, haze);
      cloudA = (1.0 - exp(-dens * CLOUD_DENSITY)) * (1.0 - haze * 0.6) * smoothstep(0.0, 0.03, d.y);
      col = mix(col, cloudCol, cloudA);
    }
  }

  // Stars: one candidate per small cell in (azimuth, elevation), round dot, gentle twinkle,
  // only where the sky is already dark, hidden by clouds.
  vec2 sc = vec2(atan(d.z, d.x), asin(clamp(d.y, -1.0, 1.0))) * 260.0;
  float h = hash12(floor(sc));
  float dotShape = smoothstep(0.32, 0.0, length(fract(sc) - 0.5));
  float skyLum = dot(col, vec3(0.299, 0.587, 0.114));
  float star = step(0.997, h) * dotShape * smoothstep(0.1, 0.4, hh) * smoothstep(0.09, 0.03, skyLum) * (1.0 - cloudA);
  star *= 0.6 + 0.4 * sin(uTime * (1.5 + h * 3.0) + h * 60.0);
  col += vec3(0.9, 0.9, 1.0) * star * STAR_AMOUNT * (0.3 + 0.7 * uIntensity);

  gl_FragColor = vec4(col, 1.0);
}
