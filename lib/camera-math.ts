import gsap from "gsap";
import { frameState } from "./store";
import { isNarrow } from "./device";
import type { RouteDescriptor } from "./route";
import { getPostCanvas } from "@/three/postApi";
import { ROUTE_MOVE_DURATION } from "./timing";

const EO = "expo.out";

interface CamPose {
  pos: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
}

/**
 * From the prototype's camFor().
 *
 * When tuning the poses: the closed stone has to stay fully in frame, idle sway/bob included
 * (IDLE_* in three/Monolith.tsx). Moving closer eats the vertical margin first, so check the
 * top and bottom of the stone after touching z/rad or C.y.
 */
export function camFor(r: RouteDescriptor, n = isNarrow()): CamPose {
  const C = { x: 0, y: 2.15, z: 0 };
  let pos: { x: number; y: number; z: number };
  let off: number;

  if (r.name === "home") {
    // Was z 12.8/9.6. C.y a bit lower so the bob still fits, watch the bottom tip if closer.
    pos = n ? { x: 0, y: 2, z: 8.6 } : { x: 0.4, y: 1.75, z: 6.4 };
    off = n ? 0 : 1.35;
    C.y = n ? 2.1 : 1.8;
  } else if (r.name === "about") {
    pos = n ? { x: -2.2, y: 1.2, z: 11.2 } : { x: 3.6, y: 0.95, z: 7 };
    off = n ? 0 : 1.25;
    C.y = n ? 2.6 : 2.35;
  } else {
    // Same pose for every project. It used to vary per index and the opening looked different
    // on each one.
    const a = 0.5;
    // Closer than before (was 10.5-11.5 narrow / 6.4-7.4 wide).
    const rad = n ? 7.5 : 4.8;
    pos = { x: Math.sin(a) * rad, y: 1.5, z: Math.cos(a) * rad };
    // Centered on project pages (off = 0) so the photo sits in the middle, not on a third.
    off = 0;
    C.y = n ? 2.5 : 2.2;
  }

  const fx = C.x - pos.x;
  const fz = C.z - pos.z;
  const fl = Math.hypot(fx, fz) || 1;
  const rx = -fz / fl;
  const rz = fx / fl;
  return { pos, target: { x: C.x - rx * off, y: C.y, z: C.z - rz * off } };
}

export function moveCamera(
  route: RouteDescriptor,
  intro: boolean,
  reducedMotion: boolean,
  durationOverride?: number
): void {
  const c = camFor(route);
  const assign = () => {
    Object.assign(frameState.cam.pos, c.pos);
    Object.assign(frameState.cam.target, c.target);
  };

  if (reducedMotion) {
    const canvas = getPostCanvas();
    if (canvas && !intro) {
      gsap.to(canvas, {
        opacity: 0,
        duration: 0.35,
        ease: "power1.out",
        onComplete() {
          assign();
          gsap.to(canvas, { opacity: 1, duration: 0.6, ease: "power1.out" });
        },
      });
    } else {
      assign();
    }
    return;
  }

  if (intro) {
    const p = c.pos;
    const t = c.target;
    frameState.cam.pos.x = t.x + (p.x - t.x) * 1.7;
    frameState.cam.pos.y = p.y - 0.4;
    frameState.cam.pos.z = t.z + (p.z - t.z) * 1.7;
    Object.assign(frameState.cam.target, { x: t.x, y: t.y + 0.3, z: t.z });
  }

  const opts = {
    duration: durationOverride ?? (intro ? 4.8 : ROUTE_MOVE_DURATION),
    ease: intro ? EO : "power3.inOut",
    overwrite: true,
  };
  gsap.to(frameState.cam.pos, { ...c.pos, ...opts });
  gsap.to(frameState.cam.target, { ...c.target, ...opts });
}

/** Reused by the resize handler to re-target the camera without a full transition. */
export function snapOrEaseCamera(route: RouteDescriptor, reducedMotion: boolean): void {
  const c = camFor(route);
  if (reducedMotion) {
    Object.assign(frameState.cam.pos, c.pos);
    Object.assign(frameState.cam.target, c.target);
    return;
  }
  const opts = { duration: 1.4, ease: EO, overwrite: true };
  gsap.to(frameState.cam.pos, { ...c.pos, ...opts });
  gsap.to(frameState.cam.target, { ...c.target, ...opts });
}
