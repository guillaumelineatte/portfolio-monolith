export const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export const nextFrame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));

// camera move between pages, the stone burst uses the same duration
export const ROUTE_MOVE_DURATION = 2.8;

// back to home from a project: camera and stone closing share this
export const RETURN_HOME_DURATION = 5;
