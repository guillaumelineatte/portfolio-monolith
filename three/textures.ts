import * as THREE from "three";
import type { Project } from "@/content/types";
import { drawVisual } from "@/lib/visual";

/**
 * Built with new THREE.Texture() rather than TextureLoader, which defaults to SRGBColorSpace.
 * A bare Texture is NoColorSpace, like the prototype's CanvasTexture. See PostProcess.tsx.
 */

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

/** Synchronous, always returns a usable texture (the canvas fallback until/unless a real photo loads). */
export function getProjectTexture(project: Project, index: number): THREE.Texture {
  const existing = cache.get(index);
  if (existing) return existing;
  const tex = fallbackTexture(project, index);
  cache.set(index, tex);
  return tex;
}

/**
 * Preloads a project's photo and swaps it into the cached texture. Always resolves (with a
 * timeout) so the loader can count it.
 */
export function preloadProjectTexture(project: Project, index: number, timeoutMs = 2500): Promise<void> {
  getProjectTexture(project, index); // ensure a fallback exists immediately

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
    img.src = project.image;
  });
}
