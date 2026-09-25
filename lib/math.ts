export function damp(a: number, b: number, lambda: number, dt: number): number {
  return a + (b - a) * (1 - Math.exp(-lambda * dt));
}

/** Same as `damp` but for angles, takes the short way around. */
export function dampAngle(a: number, b: number, lambda: number, dt: number): number {
  const twoPi = Math.PI * 2;
  const diff = (((b - a) % twoPi) + twoPi + Math.PI) % twoPi - Math.PI;
  return a + diff * (1 - Math.exp(-lambda * dt));
}
