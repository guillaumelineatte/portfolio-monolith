varying vec3 vWorld;
varying vec3 vNormal;
varying float vMass;

// Cloud-sea lighting. The low sun is usually behind the clouds as seen from the camera, so most
// of what shows is the shadowed side: tops lit by the sky, sunward edges and thin parts glowing
// (forward scattering), crevices darker and cooler.
#define SEA_SUN 0.9
#define SEA_SKY 1.0
#define SEA_SILVER 1.1
#define SEA_GLOW 0.8
#define SEA_HORIZON 0.015
#define SEA_MIST 0.5

void main(){
  vec3 v = vWorld - uCamPos; float dist = length(v); vec3 dir = v / dist;
  vec3 hor = skyColor(normalize(vec3(dir.x, 0.0, dir.z) + vec3(1e-5)));
  vec3 L = normalize(uLightDir);
  // Billows per pixel (the mesh is too coarse for them), faded with distance before they'd
  // shimmer; `puff` doubles as local thickness.
  vec3 n = normalize(vNormal);
  float nearW = 1.0 - smoothstep(20.0, 55.0, dist);
  float puff = 0.5;
  if (nearW > 0.0) {
    int oct = dist < 16.0 ? 2 : 1;
    const float e = 0.25;
    vec2 warp = seaPuffWarp(vWorld.xz);
    float p0 = seaPuffs(vWorld.xz, warp, oct);
    float px = seaPuffs(vWorld.xz + vec2(e, 0.0), warp, oct);
    float pz = seaPuffs(vWorld.xz + vec2(0.0, e), warp, oct);
    float hScale = min(seaAmp(vWorld.xz) / SEA_NEAR_AMP, 1.0) * SEA_PUFF_HEIGHT;
    n = normalize(n - vec3(px - p0, 0.0, pz - p0) / e * hScale * nearW);
    puff = mix(puff, p0, nearW);
  }

  // Thickness: tall masses and puffy tops are dense and bright, thin parts and gaps dim and cool.
  float thick = clamp(vMass * 0.55 + puff * 0.65, 0.0, 1.3);
  float ndl = dot(n, L);
  // Soft terminator: light diffuses into a cloud well past the geometric edge.
  float diffuse = smoothstep(-0.55, 0.95, ndl);
  vec3 sunC = uLightColor;
  // Sky light: warm horizon glow on faces turned toward it, cooler lavender from above.
  vec3 skyAmb = mix(hor * vec3(0.8, 0.7, 0.75), hor * vec3(0.45, 0.45, 0.7) + vec3(0.02, 0.02, 0.05), clamp(n.y, 0.0, 1.0));
  float dens = smoothstep(0.1, 0.95, thick);
  // Hollows between billows: less sky reaches in.
  float hollow = mix(0.45, 1.0, smoothstep(0.05, 0.7, puff));
  vec3 alb = vec3(0.95, 0.9, 0.93);
  vec3 col = alb * (sunC * diffuse * SEA_SUN * mix(0.2, 1.0, dens) + skyAmb * SEA_SKY * mix(0.4, 1.0, dens)) * hollow;
  // Silver lining: edges of the billows seen against the light.
  float toSun = max(dot(dir, L), 0.0);
  float rim = pow(1.0 - max(dot(n, -dir), 0.0), 3.0) * (0.2 + 0.8 * pow(toSun, 2.0));
  col += sunC * rim * SEA_SILVER * mix(0.3, 1.0, dens);
  // Light soaking through toward the sun, brighter where the cloud is thin.
  col += sunC * pow(toSun, 6.0) * SEA_GLOW * (1.0 - 0.5 * dens);
  // Deeper and thinner parts: light scatters longer, cooler and darker.
  col *= mix(vec3(0.58, 0.56, 0.78), vec3(1.0), dens);
  // Fine, soft fluff texture up close (never an edge, just density variation).
  col *= 1.0 + snoise(vec3((vWorld.xz - seaWind() * uTime * SEA_DRIFT) * 1.1, seaTime() * 6.0)) * 0.07 * nearW;
  col *= 0.35 + 0.65 * uIntensity;

  // Light pool from the glowing stone (as before) and its contact shadow on the cloud tops.
  vec2 ld = normalize(uLightDir.xz + vec2(1e-5));
  float r = length(vWorld.xz + ld * 0.9);
  float spill = exp(-r * 1.3) * 0.55 + exp(-r * 0.45) * 0.08;
  col += uLightColor * spill * uIntensity * 0.6;
  vec2 sp = vWorld.xz + ld * 0.3;
  float sr = length(sp);
  float wide = exp(-pow(sr / mix(0.8, 1.9, uStoneOpen), 2.0) * 2.2) * mix(0.55, 0.25, uStoneOpen);
  float core = exp(-sr * sr * 30.0) * 0.45 * (1.0 - uStoneOpen);
  col *= 1.0 - clamp(wide + core, 0.0, 0.8) * (0.4 + 0.6 * uIntensity);

  col = mix(col, hor, 1.0 - exp(-dist * SEA_HORIZON));
  // Half the scene haze: the clouds already are the haze, fogging them again flattened them.
  col = mix(col, applyMist(col, vWorld, dist), SEA_MIST);
  gl_FragColor = vec4(col, 1.0);
}
