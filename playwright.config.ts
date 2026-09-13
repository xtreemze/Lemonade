import { defineConfig } from "@playwright/test";

const isCI = Boolean(process.env["CI"]);
const basePath = "/Lemonade/";
const previewOrigin = "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? "github" : "list",
  use: {
    baseURL: `${previewOrigin}${basePath}`,
    trace: "on-first-retry",
  },
  webServer: {
    command: `pnpm --filter @lemonade/web exec vite build --base=${basePath} && pnpm --filter @lemonade/web exec vite preview --host 127.0.0.1 --port 4173 --strictPort --base=${basePath}`,
    url: `${previewOrigin}${basePath}`,
    reuseExistingServer: !isCI,
  },
});
