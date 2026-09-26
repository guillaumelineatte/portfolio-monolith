import * as THREE from "three";
import gsap from "gsap";
import { ROUTE_MOVE_DURATION, RETURN_HOME_DURATION } from "@/lib/timing";
import { OPEN, fragEase, staggerLocal, WAVE } from "./stoneMotion";

/**
 * Open/close/crossfade for the stone. Monolith.tsx registers its uniforms and the photo mesh,
 * HomeView and RouteTransitionProvider call these.
 */

// How far the fragments move out when open, object space (stone radius is 0.85).
// Preview for home hover / mobile, full once a project page is open.
export const SPREAD_PREVIEW = 0.5;
export const SPREAD_FULL = 1.15;

interface StoneUniforms {
  uOpen: { value: number };
  uCrack: { value: number };
  uDrift: { value: number };
  uSpread: { value: number };
  uWaveOn: { value: number };
  uWaveFrom: { value: number };
  uWaveTo: { value: number };
  uWaveT: { value: number };
}
interface PhotoUniforms {
  uTexA: { value: THREE.Texture };
  uTexB: { value: THREE.Texture };
  uMix: { value: number };
  uReveal: { value: number };
}

let stoneU: StoneUniforms | null = null;
let photoU: PhotoUniforms | null = null;
let photoMesh: THREE.Object3D | null = null;
let currentIdx = -1;
// Spread the stone is open at (or heading to), -1 when closed/closing. Lets a repeated openStone
// with the same target be a no-op: the project page calls it on click AND when its visual
// reveals, the second call must not restart the burst halfway through.
let spreadTarget = -1;
let waveTl: gsap.core.Timeline | null = null;

// The cracks flare as the preview -> full burst starts, then settle back. (A pull-in before the
// burst was tried: it stops dead before flying out and read as a stutter.)
const BURST_CRACK_PEAK = 1.8;
// Fragment the JS-side uSpread mirror follows during the wave (middle of the stagger).
const WAVE_MIRROR_DELAY = 0.375;

export function registerStone(
  stoneUniforms: StoneUniforms | null,
  photoUniforms: PhotoUniforms | null,
  mesh: THREE.Object3D | null
): void {
  stoneU = stoneUniforms;
  photoU = photoUniforms;
  photoMesh = mesh;
}

function crossfadePhoto(texture: THREE.Texture): void {
  if (!photoU) return;
  gsap.killTweensOf(photoU.uMix);
  photoU.uTexB.value = texture;
  photoU.uMix.value = 0;
  gsap.to(photoU.uMix, {
    value: 1,
    duration: 0.7,
    ease: "power2.out",
    onComplete() {
      if (!photoU) return;
      photoU.uTexA.value = photoU.uTexB.value;
      photoU.uMix.value = 0;
    },
  });
}

interface SpreadTiming {
  duration: number;
  ease: string;
}

/** Spread changes other than the burst: pulling back in (full -> preview when going back home,
 * same duration as that camera move) and the reduced-motion/edge cases. inOut so fragments ease
 * into motion instead of jerking (and expo.out on the way back in looked like a snap). */
function spreadTiming(retreating: boolean): SpreadTiming {
  return retreating
    ? { duration: RETURN_HOME_DURATION, ease: "power2.inOut" }
    : { duration: ROUTE_MOVE_DURATION, ease: "power2.inOut" };
}

/** Stops a running burst wave without a jolt: dropping uWaveOn straight to 0 made every fragment
 * jump from its own place in the stagger to the shared uSpread (up to ~0.4 in one frame, e.g.
 * going back home mid-burst), and freezing the wave stopped them dead. So the wave keeps running
 * at its own pace (just no longer driving uSpread) while it fades out under whatever takes over. */
function cancelWave(): void {
  if (!stoneU) return;
  const u = stoneU;
  if (waveTl) {
    waveTl.kill();
    waveTl = null;
    if (u.uWaveT.value < 1) {
      gsap.to(u.uWaveT, { value: 1, duration: (1 - u.uWaveT.value) * ROUTE_MOVE_DURATION, ease: "none" });
    }
  }
  gsap.killTweensOf(u.uWaveOn);
  if (u.uWaveOn.value > 0) gsap.to(u.uWaveOn, { value: 0, duration: 1.2, ease: "sine.inOut" });
}

/** Preview -> full on opening a project: every fragment flies out on its own staggered curve
 * (stone.vert.glsl's wave, inner ones first) while the cracks flare. Lasts exactly as long as the
 * camera move, so the click reads as one gesture. uWaveT is linear, the easing is per fragment. */
function burstTo(target: number): void {
  if (!stoneU) return;
  const u = stoneU;
  cancelWave();
  gsap.killTweensOf(u.uSpread);
  gsap.killTweensOf(u.uWaveOn);
  gsap.killTweensOf(u.uWaveT);
  const from = u.uSpread.value;
  u.uWaveFrom.value = from;
  u.uWaveTo.value = target;
  u.uWaveT.value = 0;
  u.uWaveOn.value = 1;

  waveTl = gsap.timeline({ onComplete: () => void (waveTl = null) }).to(u.uWaveT, {
    value: 1,
    duration: ROUTE_MOVE_DURATION,
    ease: "none",
    onUpdate() {
      // JS-side reads of uSpread (closeStone's fromFull, retreat direction) follow the middle
      // fragment of the stagger.
      u.uSpread.value = from + (target - from) * fragEase(staggerLocal(u.uWaveT.value, WAVE_MIRROR_DELAY, WAVE.stagger));
    },
    onComplete() {
      u.uSpread.value = target;
      u.uWaveOn.value = 0;
    },
  });

  gsap.killTweensOf(u.uCrack);
  gsap
    .timeline()
    .to(u.uCrack, { value: BURST_CRACK_PEAK, duration: 0.45, ease: "sine.inOut" })
    .to(u.uCrack, { value: 1, duration: 1.8, ease: "sine.inOut" });
}

function driveSpread(target: number, reducedMotion: boolean, timing: SpreadTiming): void {
  if (!stoneU) return;
  cancelWave();
  gsap.killTweensOf(stoneU.uSpread);
  if (reducedMotion) {
    stoneU.uSpread.value = target;
    return;
  }
  gsap.to(stoneU.uSpread, { value: target, ...timing });
}

/** uOpen -> 1 at a constant rate (full open = OPEN.duration). */
function openLinear(): void {
  if (!stoneU) return;
  gsap.to(stoneU.uOpen, { value: 1, duration: (1 - stoneU.uOpen.value) * OPEN.duration, ease: "none" });
}

/** Kills any close still running and holds the stone open. Otherwise hovering mid-close only
 * changed uSpread and the stone kept closing. uOpen resumes linearly at the normal opening pace
 * from wherever it is (the per-fragment curve in the shader does the easing). */
function holdOpen(reducedMotion: boolean): void {
  if (!stoneU || !photoU) return;
  gsap.killTweensOf(stoneU.uOpen);
  gsap.killTweensOf(stoneU.uCrack);
  gsap.killTweensOf(stoneU.uDrift);
  gsap.killTweensOf(photoU.uReveal);
  if (reducedMotion) {
    stoneU.uCrack.value = 1;
    photoU.uReveal.value = 1;
    return;
  }
  if (stoneU.uOpen.value < 1) openLinear();
  if (stoneU.uCrack.value < 0.98) gsap.to(stoneU.uCrack, { value: 1, duration: 1.6, ease: "power2.out" });
  if (photoU.uReveal.value < 0.98) gsap.to(photoU.uReveal, { value: 1, duration: 1.6, ease: "power2.out" });
}

/** Opens the stone on project `index` with `texture` inside. If it's already open on another
 * project it crossfades without closing. `expanded` uses SPREAD_FULL (project page) instead
 * of SPREAD_PREVIEW (hover). */
export function openStone(texture: THREE.Texture, index: number, reducedMotion: boolean, expanded = false): void {
  if (!stoneU || !photoU) return;
  const target = expanded ? SPREAD_FULL : SPREAD_PREVIEW;
  // spreadTarget > 0 also covers a stone still early in its opening (uOpen < 0.5, e.g. a click
  // right after the hover started), which used to fall through to the closed path below and
  // snap uSpread straight to the target.
  const alreadyOpen = spreadTarget > 0 || stoneU.uOpen.value > 0.5 || (reducedMotion && photoU.uReveal.value > 0.5);

  if (alreadyOpen) {
    const closing = spreadTarget < 0;
    if (index !== currentIdx) {
      currentIdx = index;
      crossfadePhoto(texture);
    }
    // Already open at / heading to this spread (project -> project, repeated calls): the photo
    // crossfade above is all that changes.
    if (target === spreadTarget) return;
    spreadTarget = target;

    if (!reducedMotion && target > stoneU.uSpread.value + 0.05) {
      if (closing) holdOpen(false);
      burstTo(target);
      return;
    }
    const timing = spreadTiming(target < stoneU.uSpread.value);
    driveSpread(target, reducedMotion, timing);
    holdOpen(reducedMotion);
    return;
  }
  currentIdx = index;
  spreadTarget = target;
  cancelWave();
  stoneU.uSpread.value = target;

  photoU.uTexA.value = texture;
  photoU.uTexB.value = texture;
  photoU.uMix.value = 0;

  gsap.killTweensOf(stoneU.uCrack);
  gsap.killTweensOf(stoneU.uOpen);
  gsap.killTweensOf(stoneU.uDrift);
  gsap.killTweensOf(photoU.uReveal);
  if (photoMesh) {
    gsap.killTweensOf(photoMesh.scale);
    photoMesh.scale.set(0.94, 0.94, 0.94);
  }

  if (reducedMotion) {
    stoneU.uOpen.value = 0; // fragments never displace
    gsap.to(stoneU.uCrack, { value: 1, duration: 0.4, ease: "power1.out" });
    gsap.to(photoU.uReveal, { value: 1, duration: 0.6, ease: "power1.out", delay: 0.1 });
    if (photoMesh) gsap.to(photoMesh.scale, { x: 1, y: 1, z: 1, duration: 0.6, ease: "power1.out" });
    return;
  }

  // Same timings as closeStone (non-fromFull), so open and close are the same motion reversed.
  gsap.to(stoneU.uCrack, { value: 1, duration: 1.6, ease: "power2.out" });
  openLinear();
  gsap.to(photoU.uReveal, { value: 1, duration: 1.6, ease: "expo.out", delay: 0.3 });
  if (photoMesh) {
    gsap.to(photoMesh.scale, { x: 1, y: 1, z: 1, duration: 1.6, ease: "expo.out", delay: 0.3 });
  }
  gsap.to(stoneU.uDrift, { value: 1, duration: 1.0, delay: 1.8 });
}

export function closeStone(reducedMotion: boolean): void {
  if (!stoneU || !photoU) return;
  // Closing from a project's full spread: same slow motion as the driveSpread retreat, not
  // the quick hover close.
  const fromFull = stoneU.uSpread.value > (SPREAD_PREVIEW + SPREAD_FULL) / 2;
  // uReveal uses the same duration, otherwise the photo faded out before the fragments closed
  // and the stone looked empty. uOpen is linear (easing is per fragment, stoneMotion.ts): from a
  // hover it closes at the opening's pace, from a project page it matches the camera move back.
  const openDuration = (fromFull ? RETURN_HOME_DURATION : OPEN.duration) * stoneU.uOpen.value;
  currentIdx = -1;
  spreadTarget = -1;

  gsap.killTweensOf(stoneU.uCrack);
  gsap.killTweensOf(stoneU.uOpen);
  gsap.killTweensOf(stoneU.uDrift);
  gsap.killTweensOf(photoU.uReveal);
  if (photoMesh) gsap.killTweensOf(photoMesh.scale);

  gsap.to(photoU.uReveal, {
    value: 0,
    duration: reducedMotion ? 0.4 : Math.max(0.4, openDuration),
    ease: "sine.inOut",
  });
  gsap.to(stoneU.uDrift, { value: 0, duration: 0.3 });

  if (reducedMotion) {
    gsap.to(stoneU.uCrack, { value: 0, duration: 0.4, ease: "power1.out" });
    return;
  }

  const tl = gsap.timeline();
  tl.to(stoneU.uOpen, { value: 0, duration: openDuration, ease: "none" }).to(
    stoneU.uCrack,
    { value: 0, duration: fromFull ? 0.7 : 1.6, ease: "power2.out" },
    ">-0.1"
  );
}

export function isStoneOpen(): boolean {
  return !!stoneU && stoneU.uOpen.value + (stoneU.uCrack.value ? 0.01 : 0) > 0.02;
}
