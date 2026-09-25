import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // The React Compiler's `react-hooks/immutability` rule assumes hook-returned values are
    // React-managed and should never be mutated in place. Three.js/R3F is built the opposite way:
    // `renderer.toneMapping = ...`, `material.uniforms.x.value = ...` are the normal, correct way
    // to drive a WebGL scene every frame, entirely outside React's reactive model by design (see
    // useFrame in CameraRig/LightRig/PostProcess). Scoped off for the scene layer only.
    files: ["three/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/immutability": "off",
    },
  },
]);

export default eslintConfig;
