export const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export const nextFrame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));

/** Camera move between routes (moveCamera in lib/camera-math.ts). The stone's preview -> full
 * burst on opening a project (three/stoneCrack.ts) is timed to end with it, one gesture. */
export const ROUTE_MOVE_DURATION = 2.8;
