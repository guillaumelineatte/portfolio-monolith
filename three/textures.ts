import * as THREE from "three";
import type { Project } from "@/content/types";
import { drawVisual } from "@/lib/visual";

// new THREE.Texture() instead of TextureLoader, which would set SRGBColorSpace and shift colors.

const cache = new Map<number, THREE.Texture>();

function fallbackTexture(project: Project, index: number): THREE.Texture {
  const canvas = drawVisual(project, index);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// always returns something (canvas fallback until the photo loads)
export function getProjectTexture(project: Project, index: number): THREE.Texture {
  const existing = cache.get(index);
  if (existing) return existing;
  const tex = fallbackTexture(project, index);
  cache.set(index, tex);
  return tex;
}

// Loads a project photo and swaps it in. Always resolves (timeout) so the loader can count it.
export function preloadProjectTexture(project: Project, index: number, timeoutMs = 2500): Promise<void> {
  getProjectTexture(project, index); // make sure there's a fallback
  if (!project.image) return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const img = new Image();
    const timer = setTimeout(done, timeoutMs);

    img.onload = () => {
      clearTimeout(timer);
      if (settled) return;
      const tex = new THREE.Texture(img);
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.needsUpdate = true;
      const prev = cache.get(index);
      cache.set(index, tex);
      prev?.dispose();
      done();
    };
    img.onerror = () => {
      clearTimeout(timer);
      done();
    };
    img.src = project.image!;
  });
}
