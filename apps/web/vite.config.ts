import { defineConfig } from "vite";

export default defineConfig({
  build: {
    // Production targets the project's Chromium-only baseline; avoid legacy transforms in lazy 3D code.
    target: ["chrome151", "edge151"],
    // The intentionally lazy Three.js enhancement is budgeted separately.
    chunkSizeWarningLimit: 550,
  },
});
