import { defineConfig } from "vite";

export default defineConfig({
  build: {
    // The intentionally lazy Three.js enhancement is budgeted separately.
    chunkSizeWarningLimit: 550,
  },
});
