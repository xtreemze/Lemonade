import process from "node:process";
import { defineConfig } from "@playwright/test";

const isCi = Boolean(process.env["CI"]);
const basePath = "/Lemonade/";
const previewOrigin = "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./e2e",
  testIgnore: ["**/showcase/**"],
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  reporter: isCi ? "github" : "list",
  expect: {
    timeout: 7500,
  },
  use: {
    baseURL: `${previewOrigin}${basePath}`,
    trace: "on-first-retry",
  },
  webServer: {
    command: `pnpm --filter @lemonade/web exec vite build --base=${basePath} && pnpm --filter @lemonade/web exec vite preview --host 127.0.0.1 --port 4173 --strictPort --base=${basePath}`,
    url: `${previewOrigin}${basePath}`,
    reuseExistingServer: !isCi,
  },
});
