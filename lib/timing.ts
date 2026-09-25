export const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export const nextFrame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));
