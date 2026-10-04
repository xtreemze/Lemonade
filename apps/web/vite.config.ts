import { defineConfig } from "vite";

const productionChunkFor = (id: string): string | undefined => {
  const normalized = id.replaceAll("\\", "/");

  if (normalized.includes("/packages/simulation/src/")) {
    return "simulation";
  }
  if (normalized.includes("/packages/ui/src/")) {
    return "ui";
  }
  if (
    normalized.includes("/node_modules/lit/") ||
    normalized.includes("/node_modules/@lit/")
  ) {
    return "lit";
  }

  return undefined;
};

export default defineConfig({
  build: {
    // Production targets the project's Chromium-only baseline; avoid legacy transforms in lazy 3D code.
    target: ["chrome151", "edge151"],
    // Keep third-party license text out of executable chunks while preserving it in the release.
    license: { fileName: "licenses.md" },
    rolldownOptions: {
      output: {
        comments: false,
        // Keep stable domain/runtime dependencies out of the critical app entry.
        // These chunks are cacheable independently and keep the Pages entry budget meaningful
        // as persistence and ruleset features evolve.
        manualChunks: productionChunkFor,
      },
    },
    // The intentionally lazy Three.js enhancement is budgeted separately.
    chunkSizeWarningLimit: 550,
  },
});
