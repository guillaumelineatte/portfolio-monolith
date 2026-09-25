import * as THREE from "three";
import gsap from "gsap";
import { U } from "./uniforms";
import { srgbToLinear } from "@/lib/color";
import { frameState } from "@/lib/store";

const EO = "expo.out";

/** Light target color, LightRig damps toward it every frame. */
export const lightTarget = new THREE.Color(1, 0.6, 0.35);

export function setLight(hex: string): void {
  lightTarget.copy(srgbToLinear(hex));
}

export function snapLight(hex: string): void {
  lightTarget.copy(srgbToLinear(hex));
  U.uLightColor.value.copy(lightTarget);
}

// canvas handle, set by CanvasRoot.onCreated (reduced-motion cross-fade)
let postCanvas: HTMLCanvasElement | null = null;
export function registerPostCanvas(canvas: HTMLCanvasElement | null): void {
  postCanvas = canvas;
}
export function getPostCanvas(): HTMLCanvasElement | null {
  return postCanvas;
}

// shader warm-up, set by PostProcess
let compileFn: (() => void) | null = null;
export function registerCompile(fn: (() => void) | null): void {
  compileFn = fn;
}
export function getCompile(): (() => void) | null {
  return compileFn;
}

// image reveal, set by PostProcess once its uniforms exist
interface PostImageUniforms {
  uImgA: { value: THREE.Texture };
  uImgB: { value: THREE.Texture };
  uImgMix: { value: number };
  uReveal: { value: number };
  uWobble: { value: number };
  uImgPos: { value: THREE.Vector2 };
  uImgSize: { value: THREE.Vector2 };
  uImgVel: { value: THREE.Vector2 };
  uRectAspect: { value: number };
}

let imgUniforms: PostImageUniforms | null = null;
let reducedMotionFlag = false;

export function registerPostImageApi(uniforms: PostImageUniforms | null, reducedMotion: boolean): void {
  imgUniforms = uniforms;
  reducedMotionFlag = reducedMotion;
}

export function setImageReducedMotion(reducedMotion: boolean): void {
  reducedMotionFlag = reducedMotion;
}

/**
 * Reveal anchored to a DOM element (project page visual). The home hover uses the stone
 * crack instead (three/stoneCrack.ts).
 */
export function showDomImage(el: HTMLElement, texture: THREE.Texture, index: number): void {
  if (!imgUniforms) return;
  const I = frameState.img;
  imgUniforms.uImgMix.value = 0;
  I.mode = "dom";
  I.el = el;
  I.idx = index;
  I.vy = 0;
  imgUniforms.uImgA.value = texture;
  gsap.fromTo(
    imgUniforms.uReveal,
    { value: 0 },
    {
      value: 1,
      duration: reducedMotionFlag ? 0.9 : 2,
      ease: reducedMotionFlag ? "power1.out" : EO,
      overwrite: true,
    }
  );
}

export function hideImage(duration?: number): void {
  if (!imgUniforms) return;
  gsap.to(imgUniforms.uReveal, {
    value: 0,
    duration: duration ?? 0.9,
    ease: reducedMotionFlag ? "power1.out" : EO,
    overwrite: true,
    onComplete() {
      frameState.img.mode = "none";
      frameState.img.el = null;
      frameState.img.idx = -1;
    },
  });
}
