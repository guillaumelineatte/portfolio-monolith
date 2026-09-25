import * as THREE from "three";
import gsap from "gsap";

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

/** Pulling fragments back in (full -> preview when going back home) is slower with a softer
 * ease, expo.out looked like a snap. */
function spreadTiming(retreating: boolean): SpreadTiming {
  return retreating ? { duration: 6.5, ease: "power1.out" } : { duration: 2.8, ease: "expo.out" };
}

function driveSpread(target: number, reducedMotion: boolean, timing: SpreadTiming): void {
  if (!stoneU) return;
  gsap.killTweensOf(stoneU.uSpread);
  if (reducedMotion) {
    stoneU.uSpread.value = target;
    return;
  }
  gsap.to(stoneU.uSpread, { value: target, ...timing });
}

/** Kills any close still running and holds the stone open. Otherwise hovering mid-close only
 * changed uSpread and the stone kept closing.
 *
 * uOpen uses the same timing as the uSpread tween: displacement is spread * eased(uOpen) and
 * different curves made the motion look stepped. uCrack/uReveal keep their own timing. */
function holdOpen(reducedMotion: boolean, timing: SpreadTiming): void {
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
  if (stoneU.uOpen.value < 0.98) gsap.to(stoneU.uOpen, { value: 1, ...timing });
  if (stoneU.uCrack.value < 0.98) gsap.to(stoneU.uCrack, { value: 1, duration: 1.6, ease: "power2.out" });
  if (photoU.uReveal.value < 0.98) gsap.to(photoU.uReveal, { value: 1, duration: 1.6, ease: "power2.out" });
}

/** Opens the stone on project `index` with `texture` inside. If it's already open on another
 * project it crossfades without closing. `expanded` uses SPREAD_FULL (project page) instead
 * of SPREAD_PREVIEW (hover). */
export function openStone(texture: THREE.Texture, index: number, reducedMotion: boolean, expanded = false): void {
  if (!stoneU || !photoU) return;
  const target = expanded ? SPREAD_FULL : SPREAD_PREVIEW;
  const alreadyOpen = stoneU.uOpen.value > 0.5 || (reducedMotion && photoU.uReveal.value > 0.5);

  if (alreadyOpen) {
    if (index !== currentIdx) {
      currentIdx = index;
      crossfadePhoto(texture);
    }
    const timing = spreadTiming(target < stoneU.uSpread.value);
    driveSpread(target, reducedMotion, timing);
    holdOpen(reducedMotion, timing);
    return;
  }
  currentIdx = index;
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
  gsap.to(stoneU.uOpen, { value: 1, duration: 6, ease: "expo.out" });
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
  // and the stone looked empty.
  const openDuration = fromFull ? 6.5 : 5;
  currentIdx = -1;

  gsap.killTweensOf(stoneU.uCrack);
  gsap.killTweensOf(stoneU.uOpen);
  gsap.killTweensOf(stoneU.uDrift);
  gsap.killTweensOf(photoU.uReveal);
  if (photoMesh) gsap.killTweensOf(photoMesh.scale);

  gsap.to(photoU.uReveal, {
    value: 0,
    duration: reducedMotion ? 0.4 : openDuration,
    ease: "power2.out",
  });
  gsap.to(stoneU.uDrift, { value: 0, duration: 0.3 });

  if (reducedMotion) {
    gsap.to(stoneU.uCrack, { value: 0, duration: 0.4, ease: "power1.out" });
    return;
  }

  const tl = gsap.timeline();
  tl.to(stoneU.uOpen, { value: 0, duration: openDuration, ease: fromFull ? "power1.out" : "expo.out" }).to(
    stoneU.uCrack,
    { value: 0, duration: fromFull ? 0.7 : 1.6, ease: "power2.out" },
    ">-0.1"
  );
}

export function isStoneOpen(): boolean {
  return !!stoneU && stoneU.uOpen.value + (stoneU.uCrack.value ? 0.01 : 0) > 0.02;
}
