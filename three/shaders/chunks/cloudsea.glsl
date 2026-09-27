// Sea of clouds under the stone. The volume is in ground.frag.glsl, the mesh is just the top.
#define SEA_DRIFT 0.06
// top of the layer: low near the stone, higher far out
#define SEA_TOP_NEAR -0.15
#define SEA_TOP_FAR 1.1
// thickness of the layer (m)
#define SEA_THICK 2.6

vec2 seaWind(){ return normalize(vec2(0.8, 0.6)); }
float seaTime(){ return uTime * 0.008; }

// top of the cloud layer at a point (smooth, the volume does the detail)
float seaTopY(vec2 p){
  float r = length(p);
  float y = mix(SEA_TOP_NEAR, SEA_TOP_FAR, smoothstep(5.0, 35.0, r));
  // slow swell so the horizon isn't a ruler
  y += snoise(vec3(p * 0.035 - seaWind() * uTime * SEA_DRIFT * 0.035, 3.0)) * 0.5 * smoothstep(10.0, 40.0, r);
  // dip around the camera (the About camera is only ~1m high)
  float camClear = smoothstep(1.5, 5.0, distance(p, uCamPos.xz));
  return mix(min(y, uCamPos.y - 1.2), y, camClear);
}
float seaSurfaceY(vec2 p, int oct){ return seaTopY(p); }

// rough color of the cloud sea, so the mountain feet blend into it without a seam
vec3 seaDeckTint(vec3 dir){
  vec3 hor = skyColor(normalize(vec3(dir.x, 0.0, dir.z) + vec3(1e-5)));
  vec3 skyTop = vec3(dot(hor, vec3(0.3, 0.5, 0.2))) * vec3(0.82, 0.8, 1.05) + vec3(0.02, 0.02, 0.05);
  return (uLightColor * 0.4 + skyTop * 0.9) * vec3(0.9, 0.88, 0.97) * (0.35 + 0.65 * uIntensity);
}

// color the cloud sea fades to in the distance (the mountains use it too)
vec3 seaHazeColor(vec3 dir){
  vec3 hor = skyColor(normalize(vec3(dir.x, 0.0, dir.z) + vec3(1e-5)));
  // halfway to the deck color, the raw horizon was too bright (pale band)
  return mix(hor * vec3(1.0, 0.97, 1.05), seaDeckTint(dir), 0.55);
}

