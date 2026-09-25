"use client";

import { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Scene } from "@/three/Scene";
import { useSceneStore } from "@/lib/store";
import { prefersReducedMotion, probeWebGL, isLow } from "@/lib/device";
import { registerPostCanvas } from "@/three/postApi";

/**
 * Checks WebGL support before mounting <Canvas>. If it fails nothing is rendered and
 * `.no-gl` on <html> gives the gradient fallback (see globals.css).
 */
export function CanvasRoot() {
  const probed = useSceneStore((s) => s.probed);
  const hasWebGL = useSceneStore((s) => s.hasWebGL);
  const low = useSceneStore((s) => s.low);

  useEffect(() => {
    const { setReducedMotion, setLow, setHasWebGL, setProbed } = useSceneStore.getState();
    const reduced = prefersReducedMotion();
    const lowDevice = isLow();
    const webgl = probeWebGL();
    setReducedMotion(reduced);
    setLow(lowDevice);
    setHasWebGL(webgl);
    document.documentElement.classList.toggle("no-gl", !webgl);
    setProbed(true);
  }, []);

  if (!probed || !hasWebGL) return null;

  const dpr = Math.min(window.devicePixelRatio || 1, low ? 1.25 : 1.5);

  return (
    <Canvas
      dpr={dpr}
      flat
      gl={{ antialias: false, alpha: false, stencil: false, powerPreference: "high-performance" }}
      camera={{ fov: 35, near: 0.1, far: 220, position: [0.4, 1.75, 9.6] }}
      onCreated={({ gl }) => {
        gl.setClearColor("#09080b", 1);
        registerPostCanvas(gl.domElement);
      }}
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", display: "block", zIndex: 0 }}
    >
      <Scene />
    </Canvas>
  );
}
