uniform float uOpen;
uniform float uDrift;
uniform float uTime;
uniform float uSpread;
uniform vec2 uSpreadRange; // (SPREAD_PREVIEW, SPREAD_FULL)
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

void main(){
  // vObj stays at the rest position. The raymarch uses it, so the interior stays continuous
  // across fragments.
  vObj = position;
  vBoundsMin = aBoundsMin;
  vBoundsMax = aBoundsMax;

  float localT = clamp((uOpen - aDelay) / max(1e-4, 1.0 - aDelay), 0.0, 1.0);
  float eased = 1.0 - pow(2.0, -10.0 * localT);

  float angle = length(aRotAxis) * eased;
  vec3 axis = length(aRotAxis) > 1e-6 ? normalize(aRotAxis) : vec3(0.0, 1.0, 0.0);
  mat3 R = rotationMatrix(axis, angle);

  vec3 offset = position - aPivot;
  vec3 rotatedOffset = R * offset;
  vec3 rotatedNormal = normalize(R * normal);

  float driftPhase = aDelay * 41.0 + uTime * 0.6;
  vec3 drift = aOutDir * sin(driftPhase) * 0.012 * uDrift * eased;

  // aSpreadExtraFull only kicks in past the preview spread, so it rides the same uSpread tween
  // (open and retreat timings) instead of needing its own.
  float expand = clamp((uSpread - uSpreadRange.x) / max(1e-4, uSpreadRange.y - uSpreadRange.x), 0.0, 1.0);
  float spread = uSpread + aSpreadExtra + aSpreadExtraFull * expand;
  vec3 displaced = aPivot + rotatedOffset + aOutDir * (spread * eased) + drift;

  vNrm = rotatedNormal;
  vec4 w = modelMatrix * vec4(displaced, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
