"use client";

import type { Project } from "@/content/types";
import { useSceneStore } from "@/lib/store";

// Real <img>, hidden when WebGL is on (the shader draws the image over this element).
// TODO: <picture> with avif/webp/jpg once the photos are in public/work/.
export function ProjectVisual({ project }: { project: Project }) {
  const hasWebGL = useSceneStore((s) => s.hasWebGL);
  return (
    <div className="pj-visual" data-group data-visual aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- plain <img> on purpose, the reveal
          shader needs this element's exact bounding rect.
          No src when WebGL is on: the img is invisible anyway, and the 404s on the placeholder
          images were blocking the main thread enough to make the GSAP tweens jump. */}
      <img src={hasWebGL ? undefined : project.image} alt="" style={{ opacity: hasWebGL ? 0 : 1 }} />
    </div>
  );
}
