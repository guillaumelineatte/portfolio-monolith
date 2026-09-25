"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { Sky } from "./Sky";
import { Ground } from "./Ground";
import { Landscape } from "./Landscape";
import { Monolith } from "./Monolith";
import { Halo } from "./Halo";
import { MistSheets } from "./MistSheets";
import { CameraRig } from "./CameraRig";
import { LightRig } from "./LightRig";
import { PostProcess } from "./PostProcess";
import { U } from "./uniforms";
import { useSceneStore } from "@/lib/store";

export function Scene() {
  const reducedMotion = useSceneStore((s) => s.reducedMotion);
  const booted = useSceneStore((s) => s.booted);

  // When the loader is done, not on mount. Until then the scene sits at uIntensity 0 behind
  // the loader.
  useEffect(() => {
    if (!booted) return;
    if (reducedMotion) {
      U.uIntensity.value = 1;
      return;
    }
    const tween = gsap.to(U.uIntensity, {
      value: 1,
      duration: 3.8,
      delay: 0.4,
      ease: "power2.out",
    });
    return () => {
      tween.kill();
    };
  }, [booted, reducedMotion]);

  return (
    <>
      <Sky />
      <Ground />
      <Landscape />
      <Monolith />
      <Halo />
      <MistSheets />
      <CameraRig />
      <LightRig />
      <PostProcess />
    </>
  );
}
