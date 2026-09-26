/**
 * Per-fragment motion curves for the stone, shared by stone.vert.glsl (as defines) and its JS
 * mirrors (debug labels in Monolith.tsx, tests). Keep both sides in sync through these constants.
 *
 * Every fragment moves on its own time window (inner cells first, ordered by aDelay) and on the
 * same curve, fragEase: zero speed at both ends, fast early, long gentle settle. The driving
 * uniforms (uOpen, uWaveT) are tweened LINEARLY, all the easing lives here. The old curve
 * (1 - 2^-10x, and back.out for the burst) peaked at the very first frame, so each fragment fired
 * off at full speed, which read as a string of small jolts, and doubling it with an expo.out on
 * uOpen made the last fragments start late and crawl.
 */

/** Opening / closing (uOpen 0 <-> 1). */
export const OPEN = {
  /** Share of uOpen's range over which fragment start times are spread. */
  stagger: 0.4,
  /** Seconds for a full 0 -> 1 open (linear uOpen). */
  duration: 3.2,
  /** Seconds for a full 1 -> 0 close from a hover (closing from a project page follows its 6.5s
   * camera move instead, see stoneCrack.ts closeStone). */
  closeDuration: 2.4,
};

/** Preview -> full burst on opening a project (uWaveT 0 -> 1, see stoneCrack.ts burstTo). */
export const WAVE = {
  stagger: 0.35,
  /** Extra open rotation at full spread, as a fraction of each fragment's base angle. */
  rotBoost: 0.5,
};

/** aDelay tops out at 0.75 (fracture.ts). */
const MAX_DELAY = 0.75;

export const MOTION_DEFINES = {
  OPEN_STAGGER: OPEN.stagger.toFixed(4),
  WAVE_STAGGER: WAVE.stagger.toFixed(4),
  WAVE_ROT_BOOST: WAVE.rotBoost.toFixed(4),
  STAGGER_MAX_DELAY: MAX_DELAY.toFixed(4),
};

/** 1 - (1-x)^3 (1+3x): speed 12x(1-x)^2, zero at both ends, peak at x = 1/3. */
export function fragEase(x: number): number {
  const y = 1 - x;
  return 1 - y * y * y * (1 + 3 * x);
}

/** A fragment's own 0..1 progress, given the driving uniform and its aDelay. */
export function staggerLocal(t: number, delay: number, stagger: number): number {
  const d = Math.min(1, Math.max(0, delay / MAX_DELAY));
  return Math.min(1, Math.max(0, (t - d * stagger) / (1 - stagger)));
}

/** stone.vert.glsl's `eased`: how far open this fragment is. */
export function openEased(uOpen: number, delay: number): number {
  return fragEase(staggerLocal(uOpen, delay, OPEN.stagger));
}

export interface WaveState {
  uSpread: number;
  uWaveOn: number;
  uWaveFrom: number;
  uWaveTo: number;
  uWaveT: number;
}

/** stone.vert.glsl's `baseSpread`: uSpread normally, the staggered wave while one runs. */
export function fragmentBaseSpread(s: WaveState, delay: number): number {
  const wave = s.uWaveFrom + (s.uWaveTo - s.uWaveFrom) * fragEase(staggerLocal(s.uWaveT, delay, WAVE.stagger));
  return s.uSpread + (wave - s.uSpread) * s.uWaveOn;
}
