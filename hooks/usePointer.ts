"use client";

import { useEffect } from "react";
import { frameState } from "@/lib/store";

/** Global pointer tracking for the camera parallax and the cursor-follow image reveal. */
export function usePointer(): void {
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      frameState.pointer.x = e.clientX;
      frameState.pointer.y = e.clientY;
      if (e.pointerType === "mouse" || e.pointerType === "pen") {
        frameState.pointer.nx = (e.clientX / window.innerWidth) * 2 - 1;
        frameState.pointer.ny = -((e.clientY / window.innerHeight) * 2 - 1);
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);
}
