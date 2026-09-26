/**
 * The preview -> full "burst" wave (project page opening), shared by stone.vert.glsl (as defines)
 * and its JS mirrors (debug labels in Monolith.tsx, the photo-clearance check). Keep both sides
 * in sync through these constants rather than hand-copied numbers.
 */

export const WAVE = {
  /** Share of the wave's duration over which fragment start times are spread, inner cells first
   * (same ordering as the opening's aDelay). */
  stagger: 0.35,
  /** back.out strength: small overshoot past the target, then settle. */
  overshoot: 1.1,
  /** Extra open rotation at full spread, as a fraction of each fragment's base angle. */
  rotBoost: 0.5,
};

/** aDelay tops out at 0.75 (fracture.ts). */
const MAX_DELAY = 0.75;

export const WAVE_DEFINES = {
  WAVE_STAGGER: WAVE.stagger.toFixed(4),
  WAVE_OVERSHOOT: WAVE.overshoot.toFixed(4),
  WAVE_ROT_BOOST: WAVE.rotBoost.toFixed(4),
  WAVE_MAX_DELAY: MAX_DELAY.toFixed(4),
};

export function waveEase(x: number): number {
  const c1 = WAVE.overshoot;
  const y = x - 1;
  return 1 + (c1 + 1) * y * y * y + c1 * y * y;
}

/** A fragment's own 0..1 progress through the wave, given the wave's raw linear time. */
export function waveLocal(t: number, delay: number): number {
  const d = Math.min(1, Math.max(0, delay / MAX_DELAY));
  return Math.min(1, Math.max(0, (t - d * WAVE.stagger) / (1 - WAVE.stagger)));
}

export interface WaveState {
  uSpread: number;
  uWaveOn: number;
  uWaveFrom: number;
  uWaveTo: number;
  uWaveT: number;
}

/** Same as stone.vert.glsl's `baseSpread`: uSpread normally, the staggered wave while one runs. */
export function fragmentBaseSpread(s: WaveState, delay: number): number {
  const wave = s.uWaveFrom + (s.uWaveTo - s.uWaveFrom) * waveEase(waveLocal(s.uWaveT, delay));
  return s.uSpread + (wave - s.uSpread) * s.uWaveOn;
}
