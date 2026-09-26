uniform float uOpen;
uniform float uDrift;
uniform float uTime;
uniform float uSpread;
uniform vec2 uSpreadRange; // (SPREAD_PREVIEW, SPREAD_FULL)
// Preview -> full burst (stoneCrack.ts burstTo): while uWaveOn is 1 each fragment follows its own
// staggered curve from uWaveFrom to uWaveTo instead of the shared uSpread.
// OPEN_*/WAVE_*/STAGGER_* defines and the curves come from three/stoneMotion.ts, which mirrors
// this math in JS.
uniform float uWaveOn;
uniform float uWaveFrom;
uniform float uWaveTo;
uniform float uWaveT;
attribute vec3 aPivot;
attribute vec3 aOutDir;
attribute vec3 aRotAxis;
attribute float aDelay;
attribute float aSpreadExtra;
attribute float aSpreadExtraFull;
attribute vec3 aBoundsMin;
attribute vec3 aBoundsMax;
varying vec3 vObj;
varying vec3 vNrm;
varying vec3 vWorld;
varying vec3 vBoundsMin;
varying vec3 vBoundsMax;

mat3 rotationMatrix(vec3 axis, float angle){
  float s = sin(angle);
  float c = cos(angle);
  float oc = 1.0 - c;
  vec3 a = axis;
  return mat3(
    oc*a.x*a.x+c,      oc*a.x*a.y-a.z*s, oc*a.z*a.x+a.y*s,
    oc*a.x*a.y+a.z*s,  oc*a.y*a.y+c,     oc*a.y*a.z-a.x*s,
    oc*a.z*a.x-a.y*s,  oc*a.y*a.z+a.x*s, oc*a.z*a.z+c
  );
}

// Zero speed at both ends, fast early, long gentle settle (see stoneMotion.ts fragEase).
float fragEase(float x){
  float y = 1.0 - x;
  return 1.0 - y * y * y * (1.0 + 3.0 * x);
}
float staggerLocal(float t, float stagger){
  float d = clamp(aDelay / STAGGER_MAX_DELAY, 0.0, 1.0);
  return clamp((t - d * stagger) / (1.0 - stagger), 0.0, 1.0);
}

void main(){
  // vObj stays at the rest position. The raymarch uses it, so the interior stays continuous
  // across fragments.
  vObj = position;
  vBoundsMin = aBoundsMin;
  vBoundsMax = aBoundsMax;

  float eased = fragEase(staggerLocal(uOpen, OPEN_STAGGER));

  float wave = mix(uWaveFrom, uWaveTo, fragEase(staggerLocal(uWaveT, WAVE_STAGGER)));
  float baseSpread = mix(uSpread, wave, uWaveOn);
  // How far this fragment is from the preview spread toward the full one. Drives the full-only
  // extra push and a bit more rotation, so pieces tumble a little as they fly out.
  float expand = clamp((baseSpread - uSpreadRange.x) / max(1e-4, uSpreadRange.y - uSpreadRange.x), 0.0, 1.0);

  float angle = length(aRotAxis) * eased * (1.0 + WAVE_ROT_BOOST * expand);
  vec3 axis = length(aRotAxis) > 1e-6 ? normalize(aRotAxis) : vec3(0.0, 1.0, 0.0);
  mat3 R = rotationMatrix(axis, angle);

  vec3 offset = position - aPivot;
  vec3 rotatedOffset = R * offset;
  vec3 rotatedNormal = normalize(R * normal);

  float driftPhase = aDelay * 41.0 + uTime * 0.6;
  vec3 drift = aOutDir * sin(driftPhase) * 0.012 * uDrift * eased;

  // aSpreadExtraFull rides `expand`, so it follows the same motion (wave or retreat) as the rest.
  float spread = baseSpread + aSpreadExtra + aSpreadExtraFull * expand;
  vec3 displaced = aPivot + rotatedOffset + aOutDir * (spread * eased) + drift;

  vNrm = rotatedNormal;
  vec4 w = modelMatrix * vec4(displaced, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
