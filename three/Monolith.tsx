"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import gsap from "gsap";
import { VS_STONE, FS_STONE, VS_PHOTO, FS_PHOTO } from "./shaders";
import { U } from "./uniforms";
import { sceneRefs } from "./sceneRefs";
import { useSceneStore } from "@/lib/store";
import { buildFractureGeometry, copyOutDirs, setSpreadExtra, type FractureDetail } from "./fracture";
import { WAVE, MOTION_DEFINES, openEased } from "./stoneMotion";
import { registerStone, SPREAD_PREVIEW, SPREAD_FULL } from "./stoneCrack";
import { createPlaceholderTexture } from "./placeholderTexture";
import { solveFragmentClearance, type CameraPose, type ClearanceResult } from "./photoOcclusion";
import { CAM_JITTER } from "./CameraRig";
import { camFor } from "@/lib/camera-math";

// x === z so it's a round capsule, not a slab. The raymarch only uses uHalf as a rough bound.
const RADIUS = 0.85;
const LENGTH = 2.0;
const THICKNESS = 0.2;
export const STONE_HALF = new THREE.Vector3(RADIUS, LENGTH / 2 + RADIUS, RADIUS);

// 2.4 rad keeps fragment #21 on the back side, away from the project cameras. The idle motion
// only sways around this, never a full turn.
const BASE_TILT = { x: 0.04, y: 2.4, z: 0.03 };

const PHOTO_SIZE = { w: 1.0, h: 1.25 };
// drawn a bit bigger so the soft edge fades around PHOTO_SIZE, not inside it.
// The fragment check still uses PHOTO_SIZE.
const PHOTO_PLANE_SCALE = 1.25;

// Break shape, see FractureDetail. `rings` is a minimum, fracture.ts adds more where needed.
// Don't crank it up everywhere: with MSAA it cost ~12 fps for nothing visible.
const FRACTURE_DETAIL: FractureDetail = { jagSegments: 4, jagAmount: 0.09, jagMax: 0.06, rings: 1, facet: 0.5, lump: 0.035 };
const FRACTURE_DETAIL_LOW: FractureDetail = { jagSegments: 3, jagAmount: 0.09, jagMax: 0.06, rings: 2, facet: 0.5, lump: 0.035 };

// Manual extra push per fragment, on top of the automatic one. Keyed by cell count first since
// index 5 on the 14-cell version isn't the same piece. Empty for now.
// MANUAL = hover + project page, FULL = project page only.
const SPREAD_EXTRA_MANUAL: Record<number, Record<number, number>> = {};
const SPREAD_EXTRA_FULL: Record<number, Record<number, number>> = {};

// Past this much extra push, the fragment slides sideways instead of flying off.
const DEFLECT_ABOVE = 1.0;

function addExtras(a: Record<number, number>, b: Record<number, number> = {}): Record<number, number> {
  const out = { ...a };
  for (const [i, v] of Object.entries(b)) out[+i] = (out[+i] ?? 0) + v;
  return out;
}

// camera poses to test: narrow + wide, at each corner of the drift/parallax range
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

// Keeps the fragments out of the photo, for the hover (home camera) and the project page.
// Can re-aim some fragments (changes aOutDir).
// Don't try depthTest: false on the photo instead, it shows through the closed stone.
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
    // coarse geometry, so pad the photo by how far the jagged edges can stick out
    photoHalf: new THREE.Vector2(PHOTO_SIZE.w / 2 + FRACTURE_DETAIL.jagMax, PHOTO_SIZE.h / 2 + FRACTURE_DETAIL.jagMax),
    preview: { poses: jitteredPoses("home"), spread: SPREAD_PREVIEW },
    full: { poses: jitteredPoses("project"), spread: SPREAD_FULL, rotScale: 1 + WAVE.rotBoost },
    deflectAbove: DEFLECT_ABOVE,
  });
}

// Idle motion when closed: small sway + slow bob. Check the stone stays in frame at both ends
// of the bob if you change these.
const IDLE_SWAY_AMPLITUDE = 0.12;
const IDLE_SWAY_FREQ = 0.15;
const IDLE_BOB_AMPLITUDE = 0.04;
const IDLE_BOB_FREQ = 0.22;
// fade out/in time of the idle motion (s)
const IDLE_FADE_OUT = 0.9;
const IDLE_FADE_IN = 2.5;

export function Monolith() {
  const ref = useRef<THREE.Mesh>(null);
  const photoRef = useRef<THREE.Mesh>(null);
  const low = useSceneStore((s) => s.low);
  const booted = useSceneStore((s) => s.booted);
  const reducedMotion = useSceneStore((s) => s.reducedMotion);
  const introFired = useRef(false);
  const idleW = useRef(1);

  const fractureCount = low ? 14 : 28;
  const stepsMax = low ? 10 : 24;

  const fracture = useMemo(() => {
    const base = { radius: RADIUS, length: LENGTH, count: fractureCount, seed: 1337, thickness: THICKNESS };
    // photo check on the coarse build (much faster), then applied to the real one
    const coarse = buildFractureGeometry(base);
    const clearance = photoClearance(coarse);
    const f = buildFractureGeometry({ ...base, detail: low ? FRACTURE_DETAIL_LOW : FRACTURE_DETAIL });
    copyOutDirs(coarse, f);
    coarse.geometry.dispose();
    setSpreadExtra(
      f,
      addExtras(clearance.extra, SPREAD_EXTRA_MANUAL[fractureCount]),
      addExtras(clearance.extraFull, SPREAD_EXTRA_FULL[fractureCount])
    );
    return f;
  }, [fractureCount, low]);

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
      },
      U
    );
    return new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VS_STONE,
      fragmentShader: FS_STONE,
      defines: { STEPS: stepsMax, ...MOTION_DEFINES, ...(low ? { LOW_QUALITY: "" } : {}) },
      // hand-built prisms, one bad winding = a hole
      side: THREE.DoubleSide,
    });
  }, [stepsMax, low]);

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
      defines: { PLANE_ASPECT: (PHOTO_SIZE.w / PHOTO_SIZE.h).toFixed(4) },
      transparent: true,
      // writes depth so the depth of field keeps it sharp (transparent pixels are discarded).
      // depthTest has to stay on.
      depthWrite: true,
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

  // grows in with the camera intro
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

  // priority 2: after CameraRig, before LightRig (it reads stoneInv)
  useFrame((_, delta) => {
    const mesh = ref.current;
    if (!mesh) return;
    const reduced = useSceneStore.getState().reducedMotion;
    const openAmt = material.uniforms.uOpen.value as number;
    const t = U.uTime.value as number;
    // Idle motion fades out while open (the photo check assumes the base angle) and back in
    // after. Smoothstepped, otherwise the stone jumped when a close finished.
    const idleTarget = openAmt < 0.01 ? 1 : 0;
    const idleRate = idleTarget > idleW.current ? 1 / IDLE_FADE_IN : 1 / IDLE_FADE_OUT;
    const dt = Math.min(delta, 0.1);
    idleW.current += Math.sign(idleTarget - idleW.current) * Math.min(Math.abs(idleTarget - idleW.current), idleRate * dt);
    const w = reduced ? 0 : idleW.current * idleW.current * (3 - 2 * idleW.current);
    mesh.rotation.y = BASE_TILT.y + Math.sin(t * IDLE_SWAY_FREQ) * IDLE_SWAY_AMPLITUDE * w;
    mesh.position.y = STONE_HALF.y + Math.sin(t * IDLE_BOB_FREQ + 1.7) * IDLE_BOB_AMPLITUDE * w;
    mesh.updateMatrixWorld();
    (material.uniforms.uModelRot.value as THREE.Matrix3).setFromMatrix4(mesh.matrixWorld);
    U.uStoneOpen.value = openEased(openAmt, 0.375) * Math.min(1, (material.uniforms.uSpread.value as number) / SPREAD_FULL);
    U.uPhotoGlow.value = photoMaterial.uniforms.uReveal.value as number;
    if (!sceneRefs.stoneInv) sceneRefs.stoneInv = new THREE.Matrix4();
    sceneRefs.stoneInv.copy(mesh.matrixWorld).invert();

    (material.uniforms.uSteps as { value: number }).value = openAmt > 0.02 ? Math.round(stepsMax * 0.6) : stepsMax;
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
      {/* Not a child of the stone so it always faces the camera (LightRig turns it every frame). */}
      <mesh ref={photoRef} position={[0, STONE_HALF.y, 0]} material={photoMaterial} renderOrder={1}>
        <planeGeometry args={[PHOTO_SIZE.w * PHOTO_PLANE_SCALE, PHOTO_SIZE.h * PHOTO_PLANE_SCALE]} />
      </mesh>
    </>
  );
}
