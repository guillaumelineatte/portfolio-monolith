"use client";

import type { Project } from "@/content/types";
import { useSceneStore } from "@/lib/store";

/**
 * Always renders a real <img>. With WebGL on it's hidden (opacity 0) because the reveal
 * shader draws the image at this element's rect (see revealGroup in lib/text-reveal.ts).
 *
 * TODO: switch to <picture> with avif/webp/jpg once the real photos are in public/work/.
 */
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
