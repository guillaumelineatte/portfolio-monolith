import type { Project } from "@/content/types";

// Generated placeholder, used when there's no photo for a project.

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rgb = [number, number, number];

const hexRgb = (h: string): Rgb => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];
const rgba = (c: Rgb, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

export function drawVisual(p: Project, i: number): HTMLCanvasElement {
  const W = 480;
  const H = 600;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d")!;
  const R = mulberry32(1337 + i * 7919);
  const base = hexRgb(p.color);
  const ink: Rgb = [9, 8, 11];
  const white: Rgb = [246, 242, 235];
  const dark = mixRgb(base, ink, 0.86);
  const mid = mixRgb(base, ink, 0.56);
  const lite = mixRgb(base, white, 0.42);
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, rgba(dark));
  g.addColorStop(1, rgba(mid));
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  x.lineWidth = 1;

  switch (p.visual) {
    case "waves": {
      const n = 54;
      for (let k = 0; k < n; k++) {
        const t = k / (n - 1);
        const y0 = 90 + t * 440;
        const amp = 6 + 24 * Math.sin(t * Math.PI);
        const ph = R() * 6.28;
        const fr = 0.011 + R() * 0.006;
        x.beginPath();
        for (let X = 0; X <= W; X += 6) {
          const y = y0 + Math.sin(X * fr + ph) * amp * Math.sin((X / W) * Math.PI);
          if (X === 0) x.moveTo(X, y);
          else x.lineTo(X, y);
        }
        x.strokeStyle = rgba(mixRgb(base, white, t * 0.5), 0.14 + 0.56 * t);
        x.stroke();
      }
      break;
    }
    case "orb": {
      const cx = W * (0.4 + R() * 0.2);
      const cy = H * 0.5;
      const r = 145 + R() * 30;
      const halo = x.createRadialGradient(cx, cy, r * 0.7, cx, cy, r * 2.3);
      halo.addColorStop(0, rgba(base, 0.28));
      halo.addColorStop(1, rgba(base, 0));
      x.fillStyle = halo;
      x.fillRect(0, 0, W, H);
      const rg = x.createRadialGradient(cx, cy - r * 0.35, r * 0.1, cx, cy, r);
      rg.addColorStop(0, rgba(lite));
      rg.addColorStop(0.6, rgba(base));
      rg.addColorStop(1, rgba(mid, 0.2));
      x.fillStyle = rg;
      x.beginPath();
      x.arc(cx, cy, r, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = rgba(dark, 0.92);
      x.fillRect(0, H * 0.72, W, H * 0.28);
      x.fillStyle = rgba(lite, 0.55);
      x.fillRect(0, Math.round(H * 0.72), W, 1);
      break;
    }
    case "rings": {
      const cx = W * 0.5;
      const cy = H * 0.46;
      for (let k = 0; k < 28; k++) {
        const r = 12 + k * k * 0.55;
        x.beginPath();
        x.ellipse(cx + (R() - 0.5) * 6, cy, r, r * 0.92, 0, 0, Math.PI * 2);
        x.strokeStyle = rgba(mixRgb(lite, base, k / 28), 0.72 - (k / 28) * 0.6);
        x.stroke();
      }
      const rg = x.createRadialGradient(cx, cy, 0, cx, cy, 80);
      rg.addColorStop(0, rgba(lite, 0.9));
      rg.addColorStop(1, rgba(base, 0));
      x.fillStyle = rg;
      x.fillRect(0, 0, W, H);
      break;
    }
    case "arches": {
      const n = 6;
      const floor = H - 70;
      for (let k = n - 1; k >= 0; k--) {
        const w = 90 + k * 52;
        const h = 200 + k * 56;
        const x0 = (W - w) / 2;
        const y0 = floor - h;
        const t = k / (n - 1);
        x.beginPath();
        x.moveTo(x0, floor);
        x.lineTo(x0, y0 + w / 2);
        x.arc(W / 2, y0 + w / 2, w / 2, Math.PI, 0);
        x.lineTo(x0 + w, floor);
        x.closePath();
        const gg = x.createLinearGradient(0, y0, 0, floor);
        gg.addColorStop(0, rgba(mixRgb(lite, base, t)));
        gg.addColorStop(1, rgba(mixRgb(base, dark, t * 0.8 + 0.2)));
        x.fillStyle = gg;
        x.fill();
      }
      x.fillStyle = rgba(dark);
      x.fillRect(0, floor, W, 70);
      break;
    }
    case "strata": {
      let y = 30;
      while (y < H + 40) {
        const h = 14 + R() * 64;
        const tone = R();
        const col = tone < 0.33 ? lite : tone < 0.66 ? base : mid;
        x.beginPath();
        x.moveTo(0, y);
        for (let X = 0; X <= W; X += 12) x.lineTo(X, y + Math.sin(X * 0.013 + y * 0.02) * 6);
        x.lineTo(W, y + h + 10);
        x.lineTo(0, y + h + 10);
        x.closePath();
        x.fillStyle = rgba(col, 0.32 + R() * 0.5);
        x.fill();
        y += h;
      }
      break;
    }
    default: {
      x.strokeStyle = rgba(lite, 0.09);
      for (let X = 0; X <= W; X += 24) {
        x.beginPath();
        x.moveTo(X + 0.5, 0);
        x.lineTo(X + 0.5, H);
        x.stroke();
      }
      for (let Y = 0; Y <= H; Y += 24) {
        x.beginPath();
        x.moveTo(0, Y + 0.5);
        x.lineTo(W, Y + 0.5);
        x.stroke();
      }
      const bx = 48 + Math.floor(R() * 4) * 24;
      const by = 96 + Math.floor(R() * 5) * 24;
      const bw = 24 * (6 + Math.floor(R() * 4));
      const bh = 24 * (8 + Math.floor(R() * 5));
      const gg = x.createLinearGradient(bx, by, bx + bw, by + bh);
      gg.addColorStop(0, rgba(lite));
      gg.addColorStop(1, rgba(base));
      x.fillStyle = gg;
      x.fillRect(bx, by, bw, bh);
      for (let k = 0; k < 5; k++) {
        x.fillStyle = rgba(lite, 0.45 + R() * 0.4);
        x.fillRect(24 * Math.floor(R() * 19), 24 * Math.floor(R() * 24), 24, 24);
      }
    }
  }

  const v = x.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.78);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,.38)");
  x.fillStyle = v;
  x.fillRect(0, 0, W, H);

  drawTemplateOverlay(x, p, W, H);
  return c;
}

// Little card (tag, title, client) so it looks like a photo slot, not noise. Keep it in the
// middle, project pages crop the canvas to 16:10.
function drawTemplateOverlay(x: CanvasRenderingContext2D, p: Project, W: number, H: number): void {
  const midY = H * 0.5;
  const font = (weight: number, size: number) => `${weight} ${size}px Inter, "Helvetica Neue", Arial, sans-serif`;

  const scrim = x.createLinearGradient(0, H * 0.28, 0, H * 0.72);
  scrim.addColorStop(0, "rgba(9,8,11,0)");
  scrim.addColorStop(0.5, "rgba(9,8,11,.62)");
  scrim.addColorStop(1, "rgba(9,8,11,0)");
  x.fillStyle = scrim;
  x.fillRect(0, H * 0.28, W, H * 0.44);

  x.textAlign = "center";
  x.textBaseline = "alphabetic";

  x.fillStyle = "rgba(237,234,228,.42)";
  x.font = font(500, 11);
  x.fillText("TEMPLATE — REPLACE ME", W / 2, midY - 42);

  x.fillStyle = "rgba(237,234,228,.97)";
  x.font = font(300, 36);
  x.fillText(p.title, W / 2, midY + 6);

  x.fillStyle = "rgba(237,234,228,.6)";
  x.font = font(500, 14);
  x.fillText(p.client.toUpperCase(), W / 2, midY + 34);

  x.textAlign = "left";
}
