import { defineConfig } from "vite";

export default defineConfig({
  build: {
    // Production targets the project's Chromium-only baseline; avoid legacy transforms in lazy 3D code.
    target: ["chrome151", "edge151"],
    // Keep third-party license text out of executable chunks while preserving it in the release.
    license: { fileName: "licenses.md" },
    rolldownOptions: {
      output: {
        comments: false,
      },
    },
    // The intentionally lazy Three.js enhancement is budgeted separately.
    chunkSizeWarningLimit: 550,
  },
});
