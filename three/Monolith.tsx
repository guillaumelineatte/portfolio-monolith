"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import gsap from "gsap";
import { VS_STONE, FS_STONE, VS_PHOTO, FS_PHOTO } from "./shaders";
import { U } from "./uniforms";
import { sceneRefs } from "./sceneRefs";
import { useSceneStore } from "@/lib/store";
import { buildFractureGeometry, setSpreadExtra, spreadExpand } from "./fracture";
import { WAVE, MOTION_DEFINES, fragmentBaseSpread, openEased } from "./stoneMotion";
import { registerStone, SPREAD_PREVIEW, SPREAD_FULL } from "./stoneCrack";
import { createPlaceholderTexture } from "./placeholderTexture";
import { solveFragmentClearance, type CameraPose, type ClearanceResult } from "./photoOcclusion";
import { CAM_JITTER } from "./CameraRig";
import { camFor } from "@/lib/camera-math";

// Debug: draws each fragment's index so I can see which ones block the photo.
// Plain DOM nodes positioned by hand every frame. drei <Text> needs to fetch a font and ~28
// <Html> hung the boot, so no drei here. Set to false when done.
const DEBUG_FRAGMENT_LABELS = true;

// x === z so the bound is round (capsule) instead of a slab. The raymarch only uses uHalf as
// a rough bounding volume, so it didn't need changes.
const RADIUS = 0.85;
const LENGTH = 2.0;
const THICKNESS = 0.2;
const SEED_UNIFORM_SIZE = 32;
export const STONE_HALF = new THREE.Vector3(RADIUS, LENGTH / 2 + RADIUS, RADIUS);

// 2.4 rad puts fragment #21 on the back, away from every project camera angle (they stay
// within ~60deg of front). Idle is a small sway around this, never a full turn.
const BASE_TILT = { x: 0.04, y: 2.4, z: 0.03 };

const PHOTO_SIZE = { w: 1.0, h: 1.25 };

// Hand-picked extra push, on top of the automatic photo clearance below. Additive, object space.
// Keyed by fracture cell count first: the same index is a different fragment on the 14-cell
// low-end fracture. Empty for now, the automatic clearance handles 5/15 (the ones that used to need
// a manual push).
// SPREAD_EXTRA_MANUAL applies in every open state (home hover preview and project page).
// SPREAD_EXTRA_FULL only once a project page is open (fades in between SPREAD_PREVIEW and SPREAD_FULL).
const SPREAD_EXTRA_MANUAL: Record<number, Record<number, number>> = {};
const SPREAD_EXTRA_FULL: Record<number, Record<number, number>> = {};

// A fragment that would need more than this extra push to clear the photo slides sideways instead
// (photoOcclusion.ts's deflectSideways), rather than flying far beyond its neighbours.
const DEFLECT_ABOVE = 1.0;

function addExtras(a: Record<number, number>, b: Record<number, number> = {}): Record<number, number> {
  const out = { ...a };
  for (const [i, v] of Object.entries(b)) out[+i] = (out[+i] ?? 0) + v;
  return out;
}

/** Both project (or home) camera poses, narrow + wide (a low device can be either), at every
 * corner of CameraRig's drift/parallax range. */
function jitteredPoses(name: "home" | "project"): CameraPose[] {
  const poses: CameraPose[] = [];
  for (const narrow of [false, true]) {
    const { pos, target } = camFor({ name, index: name === "project" ? 0 : -1 }, narrow);
    for (const sx of [-1, 0, 1])
      for (const sy of [-1, 0, 1])
        for (const sz of [-1, 1])
          poses.push({
            pos: { x: pos.x + sx * CAM_JITTER.x, y: pos.y + sy * CAM_JITTER.y, z: pos.z + sz * CAM_JITTER.z },
            target,
          });
  }
  return poses;
}

/**
 * Keeps fragments out of the photo, computed from the geometry (photoOcclusion.ts) instead of a
 * hand-tuned index map, which went stale every time the camera moved and pointed at the wrong
 * cells on the 14-fragment low-end fracture. Two stages: home hover (home camera, SPREAD_PREVIEW)
 * and project page (project camera, SPREAD_FULL). Mutates aOutDir for re-aimed fragments.
 * Don't use depthTest:false on the photo instead, it shows through the closed stone.
 */
function photoClearance(fracture: ReturnType<typeof buildFractureGeometry>): ClearanceResult {
  const stoneMatrix = new THREE.Matrix4().compose(
    new THREE.Vector3(0, STONE_HALF.y, 0),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(BASE_TILT.x, BASE_TILT.y, BASE_TILT.z)),
    new THREE.Vector3(1, 1, 1)
  );
  return solveFragmentClearance({
    fracture,
    stoneMatrix,
    photoCenter: new THREE.Vector3(0, STONE_HALF.y, 0),
    photoHalf: new THREE.Vector2(PHOTO_SIZE.w / 2, PHOTO_SIZE.h / 2),
    preview: { poses: jitteredPoses("home"), spread: SPREAD_PREVIEW },
    full: { poses: jitteredPoses("project"), spread: SPREAD_FULL, rotScale: 1 + WAVE.rotBoost },
    deflectAbove: DEFLECT_ABOVE,
  });
}

// Idle while closed: small yaw sway around BASE_TILT.y (never a full turn, another face
// would end up in front) and a slow vertical bob.
// The whole bob range has to stay in frame for every pose in lib/camera-math.ts, check both
// ends when changing these.
const IDLE_SWAY_AMPLITUDE = 0.12;
const IDLE_SWAY_FREQ = 0.15;
const IDLE_BOB_AMPLITUDE = 0.04;
const IDLE_BOB_FREQ = 0.22;
// Seconds for the idle sway to fade out as the stone starts opening / back in once it's closed.
const IDLE_FADE_OUT = 0.9;
const IDLE_FADE_IN = 2.5;

function seedsToVectorArray(seedsXY: Float32Array): THREE.Vector2[] {
  const arr: THREE.Vector2[] = [];
  for (let i = 0; i < SEED_UNIFORM_SIZE; i++) {
    const x = seedsXY[i * 2] ?? 0;
    const y = seedsXY[i * 2 + 1] ?? 0;
    arr.push(new THREE.Vector2(x, y));
  }
  return arr;
}

const labelScratch = new THREE.Vector3();

export function Monolith() {
  const ref = useRef<THREE.Mesh>(null);
  const photoRef = useRef<THREE.Mesh>(null);
  const labelEls = useRef<HTMLDivElement[]>([]);
  const low = useSceneStore((s) => s.low);
  const booted = useSceneStore((s) => s.booted);
  const reducedMotion = useSceneStore((s) => s.reducedMotion);
  const introFired = useRef(false);
  const idleW = useRef(1);

  const fractureCount = low ? 14 : 28;
  const stepsMax = low ? 10 : 24;

  const fracture = useMemo(() => {
    const f = buildFractureGeometry({
      radius: RADIUS,
      length: LENGTH,
      count: fractureCount,
      seed: 1337,
      thickness: THICKNESS,
    });
    const clearance = photoClearance(f);
    setSpreadExtra(
      f,
      addExtras(clearance.extra, SPREAD_EXTRA_MANUAL[fractureCount]),
      addExtras(clearance.extraFull, SPREAD_EXTRA_FULL[fractureCount])
    );
    if (DEBUG_FRAGMENT_LABELS) console.info("[Monolith] photo clearance", clearance);
    return f;
  }, [fractureCount]);

  const material = useMemo(() => {
    const uniforms = Object.assign(
      {
        uCamObj: { value: new THREE.Vector3() },
        uLightObj: { value: new THREE.Vector3() },
        uHalf: { value: STONE_HALF },
        uGain: { value: 1.55 },
        uSteps: { value: stepsMax },
        uOpen: { value: 0 },
        uCrack: { value: 0 },
        uDrift: { value: 0 },
        uSpread: { value: SPREAD_PREVIEW },
        uSpreadRange: { value: new THREE.Vector2(SPREAD_PREVIEW, SPREAD_FULL) },
        uModelRot: { value: new THREE.Matrix3() },
        uWaveOn: { value: 0 },
        uWaveFrom: { value: SPREAD_PREVIEW },
        uWaveTo: { value: SPREAD_PREVIEW },
        uWaveT: { value: 0 },
        uSeeds: { value: seedsToVectorArray(fracture.seedsXY) },
        uSeedCount: { value: fracture.count },
      },
      U
    );
    return new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VS_STONE,
      fragmentShader: FS_STONE,
      defines: { STEPS: stepsMax, ...MOTION_DEFINES, ...(low ? { LOW_QUALITY: "" } : {}) },
      // ~28 hand-built prisms, one bad winding would leave a hole. DoubleSide is cheap here.
      side: THREE.DoubleSide,
    });
  }, [fracture, stepsMax, low]);

  const photoMaterial = useMemo(() => {
    const placeholder = createPlaceholderTexture();
    const uniforms = Object.assign(
      {
        uTexA: { value: placeholder as THREE.Texture },
        uTexB: { value: placeholder as THREE.Texture },
        uMix: { value: 0 },
        uReveal: { value: 0 },
      },
      U
    );
    return new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VS_PHOTO,
      fragmentShader: FS_PHOTO,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }, []);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    mesh.updateMatrixWorld(true);
    sceneRefs.stoneMesh = mesh;
    sceneRefs.stoneInv = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
    sceneRefs.stoneUniforms = {
      uCamObj: material.uniforms.uCamObj as { value: THREE.Vector3 },
      uLightObj: material.uniforms.uLightObj as { value: THREE.Vector3 },
    };
    sceneRefs.photoMesh = photoRef.current;
    registerStone(
      {
        uOpen: material.uniforms.uOpen as { value: number },
        uCrack: material.uniforms.uCrack as { value: number },
        uDrift: material.uniforms.uDrift as { value: number },
        uSpread: material.uniforms.uSpread as { value: number },
        uWaveOn: material.uniforms.uWaveOn as { value: number },
        uWaveFrom: material.uniforms.uWaveFrom as { value: number },
        uWaveTo: material.uniforms.uWaveTo as { value: number },
        uWaveT: material.uniforms.uWaveT as { value: number },
      },
      {
        uTexA: photoMaterial.uniforms.uTexA as { value: THREE.Texture },
        uTexB: photoMaterial.uniforms.uTexB as { value: THREE.Texture },
        uMix: photoMaterial.uniforms.uMix as { value: number },
        uReveal: photoMaterial.uniforms.uReveal as { value: number },
      },
      photoRef.current
    );
    return () => {
      sceneRefs.stoneMesh = null;
      sceneRefs.stoneInv = null;
      sceneRefs.stoneUniforms = null;
      sceneRefs.photoMesh = null;
      registerStone(null, null, null);
    };
  }, [material, photoMaterial]);

  // Scale in with the camera intro instead of just fading in.
  useEffect(() => {
    if (!booted || introFired.current) return;
    introFired.current = true;
    const mesh = ref.current;
    if (!mesh) return;
    if (reducedMotion) {
      mesh.scale.set(1, 1, 1);
      return;
    }
    mesh.scale.set(0.3, 0.3, 0.3);
    gsap.to(mesh.scale, { x: 1, y: 1, z: 1, duration: 2.6, delay: 0.3, ease: "expo.out" });
  }, [booted, reducedMotion]);

  // Debug labels (see DEBUG_FRAGMENT_LABELS), plain DOM, created once.
  useEffect(() => {
    if (!DEBUG_FRAGMENT_LABELS) return;
    const container = document.createElement("div");
    container.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;";
    document.body.appendChild(container);
    labelEls.current = fracture.cells.map((_cell, i) => {
      const el = document.createElement("div");
      el.textContent = String(i);
      el.style.cssText =
        "position:absolute;left:0;top:0;color:#ff3b30;font:700 14px/1 sans-serif;" +
        "text-shadow:0 0 3px #000,0 0 6px #000;transform:translate(-50%,-50%);";
      container.appendChild(el);
      return el;
    });
    return () => {
      container.remove();
      labelEls.current = [];
    };
  }, [fracture]);

  // Priority 2, between CameraRig (1) and LightRig (3): idle motion and stoneInv have to be
  // updated before LightRig reads them. Also lowers uSteps while opening.
  useFrame((state, delta) => {
    const mesh = ref.current;
    if (!mesh) return;
    const reduced = useSceneStore.getState().reducedMotion;
    const openAmt = material.uniforms.uOpen.value as number;
    const t = U.uTime.value as number;
    // Idle sway/bob, faded out while open so every open uses the same base angle/height (the photo
    // clearance is computed for it). The weight ramps linearly and goes through a smoothstep, so
    // the stone eases into and out of the sway: switching it straight back on when a close
    // finished jumped the stone by up to IDLE_SWAY_AMPLITUDE in one frame.
    const idleTarget = openAmt < 0.01 ? 1 : 0;
    const idleRate = idleTarget > idleW.current ? 1 / IDLE_FADE_IN : 1 / IDLE_FADE_OUT;
    const dt = Math.min(delta, 0.1);
    idleW.current += Math.sign(idleTarget - idleW.current) * Math.min(Math.abs(idleTarget - idleW.current), idleRate * dt);
    const w = reduced ? 0 : idleW.current * idleW.current * (3 - 2 * idleW.current);
    mesh.rotation.y = BASE_TILT.y + Math.sin(t * IDLE_SWAY_FREQ) * IDLE_SWAY_AMPLITUDE * w;
    mesh.position.y = STONE_HALF.y + Math.sin(t * IDLE_BOB_FREQ + 1.7) * IDLE_BOB_AMPLITUDE * w;
    mesh.updateMatrixWorld();
    (material.uniforms.uModelRot.value as THREE.Matrix3).setFromMatrix4(mesh.matrixWorld);
    if (!sceneRefs.stoneInv) sceneRefs.stoneInv = new THREE.Matrix4();
    sceneRefs.stoneInv.copy(mesh.matrixWorld).invert();

    (material.uniforms.uSteps as { value: number }).value = openAmt > 0.02 ? Math.round(stepsMax * 0.6) : stepsMax;

    // Debug: same displacement as stone.vert.glsl for each fragment pivot, projected to screen
    // by hand to place the label.
    if (DEBUG_FRAGMENT_LABELS) {
      const mu = material.uniforms;
      const wave = {
        uSpread: mu.uSpread.value as number,
        uWaveOn: mu.uWaveOn.value as number,
        uWaveFrom: mu.uWaveFrom.value as number,
        uWaveTo: mu.uWaveTo.value as number,
        uWaveT: mu.uWaveT.value as number,
      };
      const drift = mu.uDrift.value as number;
      const time = U.uTime.value as number;
      fracture.cells.forEach((cell, i) => {
        const el = labelEls.current[i];
        if (!el) return;
        const spread = fragmentBaseSpread(wave, cell.delay);
        const expand = spreadExpand(spread, SPREAD_PREVIEW, SPREAD_FULL);
        const eased = openEased(openAmt, cell.delay);
        const driftPhase = cell.delay * 41 + time * 0.6;
        const driftAmt = Math.sin(driftPhase) * 0.012 * drift * eased;
        labelScratch
          .copy(cell.outDir)
          .multiplyScalar((spread + cell.spreadExtra + cell.spreadExtraFull * expand) * eased + driftAmt)
          .add(cell.pivot);
        labelScratch.applyMatrix4(mesh.matrixWorld);
        labelScratch.project(state.camera);
        if (labelScratch.z > 1) {
          el.style.display = "none";
          return;
        }
        el.style.display = "block";
        const x = (labelScratch.x * 0.5 + 0.5) * state.size.width;
        const y = (1 - (labelScratch.y * 0.5 + 0.5)) * state.size.height;
        el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      });
    }
  }, 2);

  return (
    <>
      <mesh
        ref={ref}
        position={[0, STONE_HALF.y, 0]}
        rotation={[BASE_TILT.x, BASE_TILT.y, BASE_TILT.z]}
        material={material}
        geometry={fracture.geometry}
      />
      {/* Sibling of the stone, not a child, so it always faces the camera. LightRig billboards
          it every frame (sceneRefs.photoMesh). */}
      <mesh ref={photoRef} position={[0, STONE_HALF.y, 0]} material={photoMaterial} renderOrder={1}>
        <planeGeometry args={[PHOTO_SIZE.w, PHOTO_SIZE.h]} />
      </mesh>
    </>
  );
}
