uniform vec3 uCamObj; uniform vec3 uLightObj; uniform vec3 uHalf; uniform float uGain;
uniform int uSteps;
uniform float uCrack;

// Broken stone: diffuse, light wrap, how much of the interior shows through, glints.
#define RAW_DIFFUSE 0.62
#define RAW_WRAP 0.25
// how much the page colour tints the breaks (lower = paler)
#define RAW_TINT 0.6
#define RAW_VOLUME 0.55
#define RAW_GLINT 0.7
// how much of the scene haze the stone gets
#define STONE_MIST 0.5
// photo light on the broken faces
#define PHOTO_BOUNCE 0.45

// Polished skin: relief, highlight, sky reflection, roughness range.
#define SKIN_BUMP 0.5
#define SKIN_SPEC 1.2
#define SKIN_ENV 0.45
#define SKIN_ROUGH_MIN 0.22
#define SKIN_ROUGH_MAX 0.5
// backlit rim: strength, tightness
#define SKIN_RIM 0.9
#define SKIN_RIM_POWER 5.0

// Interior: absorption per channel (red goes deepest), stylised palette amount (0.62 for the
// old look), marble veins.
#define SSS_ABSORB vec3(1.25, 1.75, 2.35)
#define PALETTE_MIX 0.45
#define VEIN_STRENGTH 0.8
#define VEIN_COLOR vec3(0.62, 0.52, 0.47)

// Cracks light up from the center outward as uCrack goes 0 -> 1, with a brighter front.
#define CRACK_REACH 3.6
#define CRACK_FRONT 2.4

uniform mat3 uModelRot; // object -> world rotation, for the sky reflection

// Surface relief, in rest-pose object space so it sticks to the fragments.
float skinHeight(vec3 p){
  float h = snoise(p * 3.1) * 0.55 + snoise(p * 8.7 + 11.3) * 0.3;
#ifndef LOW_QUALITY
  h += snoise(p * 23.0 + 5.1) * 0.07;
#endif
  return h;
}
vec3 bumpNormal(vec3 n, vec3 p){
  const float e = 0.01;
  float h0 = skinHeight(p);
  vec3 g = vec3(skinHeight(p + vec3(e, 0.0, 0.0)), skinHeight(p + vec3(0.0, e, 0.0)), skinHeight(p + vec3(0.0, 0.0, e))) - h0;
  g /= e;
  g -= dot(g, n) * n;
  return normalize(n - g * SKIN_BUMP * 0.02);
}
float ggxD(float nh, float a){
  float a2 = a * a;
  float d = nh * nh * (a2 - 1.0) + 1.0;
  return a2 / (3.14159 * d * d);
}
varying vec3 vObj; varying vec3 vNrm; varying vec3 vWorld;
varying vec3 vBoundsMin; varying vec3 vBoundsMax;
varying float vFace; // 0 outer skin, 1/2 broken (inner face, cut walls)
varying float vEdgeDist; // distance to the fragment outline, for the crack glow

float boxExit(vec3 ro, vec3 rd, vec3 hb){
  vec3 s = step(0.0, rd) * 2.0 - 1.0;
  vec3 t = (s * hb - ro) * s / max(abs(rd), vec3(1e-5));
  return max(min(min(t.x, t.y), t.z), 0.0);
}
vec3 palette(float t){
  vec3 amber = vec3(1.00, 0.58, 0.26);
  vec3 rose  = vec3(0.98, 0.50, 0.58);
  vec3 blue  = vec3(0.56, 0.70, 0.98);
  t = clamp(t, 0.0, 1.0) * 2.0;
  return t < 1.0 ? mix(amber, rose, smoothstep(0.0, 1.0, t)) : mix(rose, blue, smoothstep(1.0, 2.0, t));
}

// inverse of the unroll in fracture.ts
vec2 toUnrolled(vec3 p){
  float phi = atan(p.z, p.x);
  return vec2(phi * uHalf.x, p.y);
}


void main(){
  vec3 ro = vObj;
  vec3 rd = normalize(vObj - uCamObj);
  vec3 L = normalize(uLightObj);
  vec3 n = normalize(vNrm);

  vec3 fragCenter = (vBoundsMin + vBoundsMax) * 0.5;
  vec3 fragHalf = (vBoundsMax - vBoundsMin) * 0.5;
  float tExit = boxExit(ro - fragCenter, rd, fragHalf);
  float dt = tExit / float(max(uSteps, 1));
  float jit = hash12(gl_FragCoord.xy + fract(uTime * 3.7) * 61.0);
  float c = dot(rd, L);
  const float g = 0.6;
  float hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * c, 1.5);
  float phase = 0.3 + hg * 0.18;
  vec3 acc = vec3(0.0); float T = 1.0;
  for (int i = 0; i < STEPS; i++){
    if (i >= uSteps) break;
    vec3 p = ro + rd * ((float(i) + jit) * dt);
    float w = snoise(p * vec3(0.62, 0.34, 0.62) + vec3(0.0, uTime * 0.004, 0.0));
    float y = p.y + w * 0.55;
    float layers = 0.5 + 0.5 * sin(y * 6.5 + w * 2.5);
#ifndef LOW_QUALITY
    // thin warped veins
    float vein = (1.0 - smoothstep(0.0, 0.07, abs(snoise(p * 2.2 + vec3(w * 1.4))))) * VEIN_STRENGTH;
#else
    float vein = 0.0;
#endif
    float sigma = 0.6 + 2.6 * layers * layers * layers + vein * 3.0;
    vec3 attC = exp(-boxExit(p, L, uHalf) * SSS_ABSORB);
    float att = dot(attC, vec3(0.3333));
    float hgt = clamp((y + uHalf.y) / (2.0 * uHalf.y), 0.0, 1.0);
    vec3 tint = mix(vec3(1.0), palette(hgt + w * 0.06), PALETTE_MIX);
    vec3 hot = vec3(1.08, 0.9, 0.72);
    tint = mix(tint, hot, smoothstep(0.42, 0.9, att) * 0.85);
    tint = mix(tint, VEIN_COLOR, vein);
    acc += tint * (attC * phase + 0.05) * sigma * dt * T;
    acc += hot * pow(attC, vec3(5.0)) * 1.6 * dt * T;
    T *= exp(-sigma * dt * 0.8);
  }
  vec3 vol = acc * uLightColor * uGain * uIntensity + acc * vec3(0.05, 0.045, 0.07);

  float fres = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 3.0);
  float back = clamp(c * 0.5 + 0.5, 0.0, 1.0);
  float raw = step(0.5, vFace);

  // polished skin
  float edgeDist = vEdgeDist;
  float edge = 1.0 - smoothstep(0.0, 0.035, edgeDist);
  vec3 alab = vec3(0.82, 0.77, 0.70);
  vec3 nb = raw > 0.5 ? n : bumpNormal(n, ro);
  float ndl = max(dot(nb, L), 0.0);
  vec3 surf = alab * (vec3(0.035, 0.032, 0.05) + uLightColor * ndl * 0.28) * uIntensity;
  surf = mix(surf, surf * 0.4, edge * 0.7);
  vec3 skin = surf + vol;
  skin += uLightColor * uIntensity * (fres * back * 0.35);
  // The light is behind the stone, so the edges glow through a bit. Keeps it from blending
  // into the sky.
  float rim = pow(1.0 - clamp(dot(nb, -rd), 0.0, 1.0), SKIN_RIM_POWER);
  skin += mix(vec3(1.0), uLightColor, 0.7) * uIntensity * rim * smoothstep(0.2, 1.0, back) * SKIN_RIM;
  float crackD = length(toUnrolled(ro)) + snoise(ro * 2.3) * 0.25;
  float reach = min(uCrack, 1.0) * CRACK_REACH;
  float crackLit = smoothstep(reach, reach - 0.4, crackD);
  float crackFront = exp(-abs(crackD - reach) * 7.0) * (1.0 - smoothstep(0.85, 1.0, uCrack));
  skin += uLightColor * uIntensity * edge * (crackLit * uCrack * 1.6 + crackFront * CRACK_FRONT);
  // soft highlight
  vec3 V = -rd;
  vec3 H = normalize(L + V);
  float nv = max(dot(nb, V), 1e-3);
  float rough = mix(SKIN_ROUGH_MIN, SKIN_ROUGH_MAX, snoise(ro * 1.7 + 3.0) * 0.5 + 0.5);
  float a = rough * rough;
  float k = a * 0.5;
  float vis = 0.25 / ((ndl * (1.0 - k) + k) * (nv * (1.0 - k) + k));
  float F = 0.04 + 0.96 * pow(1.0 - max(dot(H, V), 0.0), 5.0);
  skin += uLightColor * uIntensity * ggxD(max(dot(nb, H), 0.0), a) * F * vis * ndl * SKIN_SPEC;
  // sky reflection on the edges
  vec3 nW = normalize(uModelRot * nb);
  vec3 vW = normalize(uCamPos - vWorld);
  float fW = 0.04 + 0.96 * pow(1.0 - max(dot(nW, vW), 0.0), 5.0);
  skin += skyColor(reflect(-vW, nW)) * fW * SKIN_ENV * (1.0 - rough);

  // Broken stone: paler, chalky, grainy, a few glints. No crack glow here (the whole wall is on
  // an edge, it turned it all orange), only the flare during the burst.
  float grain = snoise(ro * 34.0) * 0.5 + 0.5;
  float grainFine = snoise(ro * 97.0) * 0.5 + 0.5;
  vec3 rawAlb = vec3(0.93, 0.90, 0.85) * (0.8 + 0.2 * grain) * (0.9 + 0.1 * grainFine);
  float wrap = clamp((dot(n, L) + RAW_WRAP) / (1.0 + RAW_WRAP), 0.0, 1.0);
  vec3 rawLight = mix(vec3(dot(uLightColor, vec3(0.299, 0.587, 0.114))), uLightColor, RAW_TINT);
  vec3 rawSurf = rawAlb * (vec3(0.07, 0.068, 0.09) + rawLight * wrap * RAW_DIFFUSE) * uIntensity;
  vec3 hv = normalize(L - rd);
  float glint = smoothstep(0.72, 0.92, snoise(ro * 61.0)) * pow(max(dot(n, hv), 0.0), 6.0);
  vec3 broken = rawSurf + vol * RAW_VOLUME;
  broken += uLightColor * uIntensity * glint * RAW_GLINT;
  broken += uLightColor * uIntensity * max(uCrack - 1.0, 0.0) * 0.9;
  // the photo in the middle lights the faces turned toward it
  vec3 toPhoto = -ro;
  float dPhoto = length(toPhoto);
  float photoLit = max(dot(n, toPhoto / max(dPhoto, 1e-3)), 0.0) / (1.0 + dPhoto * dPhoto * 1.5);
  broken += mix(vec3(1.0), uLightColor, 0.8) * rawAlb * photoLit * uPhotoGlow * PHOTO_BOUNCE * uIntensity;

  vec3 col = mix(skin, broken, raw);
  col *= mix(0.55, 1.0, smoothstep(0.0, 0.5, vObj.y + uHalf.y));
  // less haze on the stone, otherwise it sinks into the background
  col = mix(col, applyMist(col, vWorld, length(vWorld - uCamPos)), STONE_MIST);
  gl_FragColor = vec4(col, 1.0);
}
