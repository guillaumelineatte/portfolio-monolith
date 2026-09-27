import * as THREE from "three";
import gsap from "gsap";
import { ROUTE_MOVE_DURATION, RETURN_HOME_DURATION } from "@/lib/timing";
import { OPEN, fragEase, staggerLocal, WAVE } from "./stoneMotion";

// Open / close / crossfade for the stone. Monolith registers its uniforms, HomeView and
// RouteTransitionProvider call these.

// How far the fragments move out (stone radius is 0.85). Preview = home hover, full = project page.
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
// Current target spread, -1 when closed. The project page calls openStone twice (on click and
// when the visual shows up), the second call must not restart the burst.
let spreadTarget = -1;
let waveTl: gsap.core.Timeline | null = null;

// crack flare when the burst starts
const BURST_CRACK_PEAK = 1.8;
// uSpread follows this fragment during the wave (middle of the stagger)
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

// Spread changes other than the burst (mostly pulling back in when going home).
function spreadTiming(retreating: boolean): SpreadTiming {
  return retreating
    ? { duration: RETURN_HOME_DURATION, ease: "power2.inOut" }
    : { duration: ROUTE_MOVE_DURATION, ease: "power2.inOut" };
}

// Stops the burst without a jump: the wave keeps going on its own and fades out.
// Cutting it (or freezing it) made the fragments jump or stop dead.
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

// Preview -> full when a project opens. Fragments go out one after the other (inner ones first),
// same duration as the camera move so it all feels like one motion.
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
      // keep uSpread roughly in sync, closeStone and the retreat read it
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

// uOpen -> 1 at a constant speed
function openLinear(): void {
  if (!stoneU) return;
  gsap.to(stoneU.uOpen, { value: 1, duration: (1 - stoneU.uOpen.value) * OPEN.duration, ease: "none" });
}

// Cancels a close in progress and keeps the stone open (hovering mid-close used to do nothing).
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

// Opens the stone with the project's photo inside. Already open on another project: just
// crossfades. `expanded` = project page (full spread).
export function openStone(texture: THREE.Texture, index: number, reducedMotion: boolean, expanded = false): void {
  if (!stoneU || !photoU) return;
  const target = expanded ? SPREAD_FULL : SPREAD_PREVIEW;
  // spreadTarget > 0 catches a click right after the hover started (uOpen still low), otherwise
  // it went through the closed path and uSpread snapped
  const alreadyOpen = spreadTarget > 0 || stoneU.uOpen.value > 0.5 || (reducedMotion && photoU.uReveal.value > 0.5);

  if (alreadyOpen) {
    const closing = spreadTarget < 0;
    if (index !== currentIdx) {
      currentIdx = index;
      crossfadePhoto(texture);
    }
    // already there (project -> project): only the photo changes
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
    stoneU.uOpen.value = 0; // no movement with reduced motion
    gsap.to(stoneU.uCrack, { value: 1, duration: 0.4, ease: "power1.out" });
    gsap.to(photoU.uReveal, { value: 1, duration: 0.6, ease: "power1.out", delay: 0.1 });
    if (photoMesh) gsap.to(photoMesh.scale, { x: 1, y: 1, z: 1, duration: 0.6, ease: "power1.out" });
    return;
  }

  // same timings as the hover close
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
  // coming back from a project page: slow close, like the retreat
  const fromFull = stoneU.uSpread.value > (SPREAD_PREVIEW + SPREAD_FULL) / 2;
  // Photo fades out over the same time, otherwise it disappears first and the stone looks
  // empty. From a project page it matches the camera move back.
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
