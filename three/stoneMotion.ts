// Motion curves for the fragments, shared with stone.vert.glsl (as defines) and the JS copies.
//
// Each fragment has its own time window (inner ones first) and the same curve, fragEase: starts
// and stops softly. uOpen and uWaveT are tweened linearly, the easing is all here. Curves that
// start at full speed looked jerky.

// opening / closing (uOpen)
export const OPEN = {
  // how spread out the start times are
  stagger: 0.4,
  // seconds for a full open
  duration: 3.2,
};

// preview -> full when a project opens (burstTo in stoneCrack.ts)
export const WAVE = {
  stagger: 0.35,
  // extra rotation at full spread
  rotBoost: 0.5,
};

// max aDelay (fracture.ts)
const MAX_DELAY = 0.75;

export const MOTION_DEFINES = {
  OPEN_STAGGER: OPEN.stagger.toFixed(4),
  WAVE_STAGGER: WAVE.stagger.toFixed(4),
  WAVE_ROT_BOOST: WAVE.rotBoost.toFixed(4),
  STAGGER_MAX_DELAY: MAX_DELAY.toFixed(4),
};

// 1 - (1-x)^3 (1+3x): zero speed at both ends, fastest at x = 1/3
export function fragEase(x: number): number {
  const y = 1 - x;
  return 1 - y * y * y * (1 + 3 * x);
}

// a fragment's own 0..1 progress
export function staggerLocal(t: number, delay: number, stagger: number): number {
  const d = Math.min(1, Math.max(0, delay / MAX_DELAY));
  return Math.min(1, Math.max(0, (t - d * stagger) / (1 - stagger)));
}

// same as `eased` in stone.vert.glsl
export function openEased(uOpen: number, delay: number): number {
  return fragEase(staggerLocal(uOpen, delay, OPEN.stagger));
}
