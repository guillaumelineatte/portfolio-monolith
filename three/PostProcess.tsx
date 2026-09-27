"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { VS_POST, FS_POST } from "./shaders";
import { U } from "./uniforms";
import { useSceneStore, frameState } from "@/lib/store";
import { damp } from "@/lib/math";
import { registerPostImageApi, setImageReducedMotion, registerCompile } from "./postApi";
import { createPlaceholderTexture } from "./placeholderTexture";

// FS_POST does its own tonemap + gamma, otherwise three adds its own on top and colors shift.
THREE.ColorManagement.enabled = false;

// DOF focus height = stone center (STONE_HALF.y)
const FOCUS_Y = 1.85;

// Priority 4, runs last. Scene -> render target -> fullscreen quad (no postprocessing lib).
// Also lowers the resolution when frames get slow.
export function PostProcess() {
  const { gl, scene, camera } = useThree();
  const low = useSceneStore((s) => s.low);
  const reducedMotion = useSceneStore((s) => s.reducedMotion);
  const maxPix = low ? 520000 : 2100000;

  const floatRT = useMemo(
    () => gl.capabilities.isWebGL2 && gl.extensions.has("EXT_color_buffer_float"),
    [gl]
  );

  // MSAA on the scene pass (the canvas has antialias off). Not on low-end devices.
  const samples = gl.capabilities.isWebGL2 && !low ? 4 : 0;
  const rt = useMemo(
    () =>
      new THREE.WebGLRenderTarget(2, 2, {
        type: floatRT ? THREE.HalfFloatType : THREE.UnsignedByteType,
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: true,
        stencilBuffer: false,
        samples,
        // depth for the DOF. Has to be null, not undefined, or three crashes
        depthTexture: low ? null : new THREE.DepthTexture(2, 2, THREE.UnsignedIntType),
      }),
    [floatRT, samples, low]
  );

  useEffect(() => () => rt.dispose(), [rt]);

  const postScene = useMemo(() => new THREE.Scene(), []);
  const postCamera = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), []);
  const placeholder = useMemo(() => createPlaceholderTexture(), []);

  const postUniforms = useMemo(
    () => ({
      tScene: { value: rt.texture },
      uRes: { value: new THREE.Vector2(1, 1) },
      uTime: U.uTime,
      uGrain: { value: low ? 0.05 : 0.06 },
      uExposure: { value: 1 },
      uImgA: { value: placeholder as THREE.Texture },
      uImgB: { value: placeholder as THREE.Texture },
      uImgMix: { value: 0 },
      uReveal: { value: 0 },
      uWobble: { value: 0 },
      uImgPos: { value: new THREE.Vector2() },
      uImgSize: { value: new THREE.Vector2(1, 1) },
      uImgVel: { value: new THREE.Vector2() },
      uRectAspect: { value: 0.8 },
      uReduced: { value: reducedMotion ? 1 : 0 },
      tDepth: { value: rt.depthTexture as THREE.Texture | null },
      uNear: { value: 0.1 },
      uFar: { value: 220 },
      uFocus: { value: 6 },
    }),
    [rt, placeholder] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    postUniforms.uReduced.value = reducedMotion ? 1 : 0;
    setImageReducedMotion(reducedMotion);
  }, [reducedMotion, postUniforms]);

  useEffect(() => {
    registerPostImageApi(postUniforms, reducedMotion);
    return () => registerPostImageApi(null, reducedMotion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postUniforms]);

  useEffect(() => {
    postUniforms.uGrain.value = low ? 0.05 : 0.06;
  }, [low, postUniforms]);

  const quad = useMemo(() => {
    const material = new THREE.ShaderMaterial({
      uniforms: postUniforms,
      vertexShader: VS_POST,
      fragmentShader: FS_POST,
      defines: { BLOOM_TAPS: low ? 6 : 10, ...(low ? {} : { DOF: "" }) },
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    mesh.frustumCulled = false;
    return mesh;
  }, [postUniforms, low]);

  useEffect(() => {
    postScene.add(quad);
    return () => {
      postScene.remove(quad);
    };
  }, [postScene, quad]);

  useEffect(() => {
    registerCompile(() => {
      gl.compile(scene, camera);
      gl.compile(postScene, postCamera);
    });
    return () => registerCompile(null);
  }, [gl, scene, camera, postScene, postCamera]);

  useEffect(() => {
    // Don't set NoColorSpace, it crashes. All materials are raw shaders anyway so the renderer
    // color settings don't apply to them.
    gl.toneMapping = THREE.NoToneMapping;
  }, [gl]);

  const res = useRef({ scale: 1, ft: 16, fc: 0, lastW: -1, lastH: -1 });

  function resizeRT(width: number, height: number, dpr: number) {
    const bw = width * dpr;
    const bh = height * dpr;
    const s = Math.min(res.current.scale, Math.sqrt(maxPix / Math.max(1, bw * bh)), 1);
    rt.setSize(Math.max(2, Math.floor(bw * s)), Math.max(2, Math.floor(bh * s)));
    postUniforms.uRes.value.set(bw, bh);
    frameState.img.w = Math.min(400, Math.max(240, width * 0.2));
    frameState.img.h = frameState.img.w * 1.25;
  }

  useFrame((state, delta) => {
    // nothing to do when the tab is hidden
    if (document.hidden) return;

    const dt = Math.min(delta, 0.1);
    const { size } = state;
    const dpr = state.gl.getPixelRatio();
    const r = res.current;

    if (size.width !== r.lastW || size.height !== r.lastH) {
      r.lastW = size.width;
      r.lastH = size.height;
      resizeRT(size.width, size.height, dpr);
    }

    if (dt > 0 && dt < 0.1) {
      r.ft = r.ft * 0.94 + dt * 1000 * 0.06;
      if (++r.fc > 75) {
        r.fc = 0;
        if (r.ft > 19.5 && r.scale > 0.5) {
          r.scale = Math.max(0.5, r.scale - 0.1);
          resizeRT(size.width, size.height, dpr);
        } else if (r.ft < 14 && r.scale < 1) {
          r.scale = Math.min(1, r.scale + 0.05);
          resizeRT(size.width, size.height, dpr);
        }
      }
    }

    const I = frameState.img;
    if (I.mode !== "none") {
      let tw = I.w;
      let th2 = I.h;
      const idt = Math.max(dt, 1e-3);
      const reduced = useSceneStore.getState().reducedMotion;
      if (I.mode === "cursor") {
        const flip = frameState.pointer.x + I.w * 1.2 > size.width;
        const tx = frameState.pointer.x + (flip ? -1 : 1) * I.w * 0.62;
        const ty = frameState.pointer.y;
        if (reduced) {
          I.x = tx;
          I.y = ty;
        } else {
          I.x = damp(I.x, tx, 6.5, dt);
          I.y = damp(I.y, ty, 6.5, dt);
        }
        I.vx = damp(I.vx, (I.x - I.px) / idt, 10, dt);
        I.vy = damp(I.vy, (I.y - I.py) / idt, 10, dt);
      } else if (I.el) {
        const rect = I.el.getBoundingClientRect();
        I.x = rect.left + rect.width / 2;
        I.y = rect.top + rect.height / 2;
        tw = rect.width;
        th2 = rect.height;
        I.vx = 0;
        I.vy = damp(I.vy, -frameState.scroll.velocity * 0.8, 8, dt);
      }
      I.px = I.x;
      I.py = I.y;
      postUniforms.uImgPos.value.set(I.x * dpr, (size.height - I.y) * dpr);
      postUniforms.uImgSize.value.set(Math.max(1, tw * dpr), Math.max(1, th2 * dpr));
      postUniforms.uImgVel.value.set(I.vx, -I.vy);
      postUniforms.uRectAspect.value = tw / Math.max(1, th2);
    }

    const cam = state.camera as THREE.PerspectiveCamera;
    postUniforms.uNear.value = cam.near;
    postUniforms.uFar.value = cam.far;
    postUniforms.uFocus.value = Math.hypot(cam.position.x, cam.position.y - FOCUS_Y, cam.position.z);

    state.gl.setRenderTarget(rt);
    state.gl.render(scene, state.camera);
    state.gl.setRenderTarget(null);
    state.gl.render(postScene, postCamera);
  }, 4);

  return null;
}
