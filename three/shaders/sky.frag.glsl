varying vec3 vDir;

// Visible sky only (not skyColor(), which the stone's reflection, the ridges and the haze also
// use): low stratus bands lit by the sun from below/behind, and faint stars higher up.
#define CLOUD_AMOUNT 0.75
#define STAR_AMOUNT 0.7

void main(){
  vec3 d = normalize(vDir);
  vec3 col = skyColor(d);
  float hh = max(d.y, 0.0);

  // Stratus: noise projected on a flat cloud layer (stretches with distance toward the horizon),
  // only in a band above it, slowly drifting.
  vec2 cp = d.xz / (d.y + 0.08);
  float cn = snoise(vec3(cp * vec2(0.22, 0.9) + vec2(uTime * 0.006, 0.0), 2.3)) * 0.65
           + snoise(vec3(cp * vec2(0.8, 2.6) - vec2(uTime * 0.01, 0.0), 7.1)) * 0.35;
  float band = smoothstep(0.015, 0.06, hh) * (1.0 - smoothstep(0.12, 0.32, hh));
  float cloud = smoothstep(0.1, 0.65, cn) * band;
  float toSun = max(dot(d, uSunDir), 0.0);
  // Undersides catch the low sun (brighter toward it), the rest is a bit darker than the sky.
  vec3 lit = uLightColor * (0.25 + 1.1 * pow(toSun, 5.0)) * (0.22 + 0.78 * uIntensity);
  vec3 cloudCol = mix(col * 0.7, lit * 0.55 + col * 0.35, smoothstep(0.2, 0.9, cn));
  col = mix(col, cloudCol, cloud * CLOUD_AMOUNT);

  // Stars: one candidate per small cell in (azimuth, elevation), round dot, gentle twinkle,
  // fading in with height and darkness, out behind clouds.
  vec2 sc = vec2(atan(d.z, d.x), asin(clamp(d.y, -1.0, 1.0))) * 260.0;
  float h = hash12(floor(sc));
  float dotShape = smoothstep(0.32, 0.0, length(fract(sc) - 0.5));
  // Only where the sky itself is already dark: a star on a bright dusk sky reads as a glitch.
  float skyLum = dot(col, vec3(0.299, 0.587, 0.114));
  float star = step(0.997, h) * dotShape * smoothstep(0.1, 0.4, hh) * smoothstep(0.09, 0.03, skyLum) * (1.0 - cloud);
  star *= 0.6 + 0.4 * sin(uTime * (1.5 + h * 3.0) + h * 60.0);
  col += vec3(0.9, 0.9, 1.0) * star * STAR_AMOUNT * (0.3 + 0.7 * uIntensity);

  gl_FragColor = vec4(col, 1.0);
}
