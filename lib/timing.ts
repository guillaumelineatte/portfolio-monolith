export const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export const nextFrame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));

/** Camera move between routes (moveCamera in lib/camera-math.ts). The stone's preview -> full
 * burst on opening a project (three/stoneCrack.ts) is timed to end with it, one gesture. */
export const ROUTE_MOVE_DURATION = 2.8;

/** Going back home from a project page: the camera move, the fragments pulling back to the hover
 * spread (or closing if nothing is hovered) all share it, so it reads as one move. */
export const RETURN_HOME_DURATION = 5;
