"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useBootSequence } from "@/hooks/useBootSequence";
import { useSceneStore } from "@/lib/store";

export function Loader() {
  const progress = useBootSequence();
  const booted = useSceneStore((s) => s.booted);
  const reducedMotion = useSceneStore((s) => s.reducedMotion);
  const [removed, setRemoved] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!booted || firedRef.current) return;
    firedRef.current = true;
    const root = rootRef.current;
    if (!root) return;

    if (!reducedMotion) {
      gsap.to([numRef.current, pctRef.current], {
        yPercent: -110,
        duration: 0.8,
        ease: "power3.in",
        stagger: 0.05,
      });
    }
    gsap.to(root, {
      opacity: 0,
      duration: reducedMotion ? 0.6 : 1.4,
      delay: reducedMotion ? 0 : 0.6,
      ease: "power2.out",
      onComplete: () => setRemoved(true),
    });
  }, [booted, reducedMotion]);

  if (removed) return null;

  return (
    <div id="loader" ref={rootRef} aria-hidden="true">
      <div className="ld">
        <span className="line">
          <span className="line-i" id="ldNum" ref={numRef}>
            {progress}
          </span>
        </span>
        <span className="line">
          <span className="line-i" id="ldPct" ref={pctRef}>
            %
          </span>
        </span>
      </div>
    </div>
  );
}
