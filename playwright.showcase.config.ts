import { defineConfig } from "@playwright/test";

const isCI = Boolean(process.env["CI"]);
const basePath = "/Lemonade/";
const previewOrigin = "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./e2e/showcase",
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? "github" : "list",
  outputDir: "artifacts/e2e-media/playwright",
  expect: {
    timeout: 7_500,
  },
  use: {
    baseURL: `${previewOrigin}${basePath}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "Desktop Showcase",
      use: {
        browserName: "chromium",
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
        hasTouch: false,
        isMobile: false,
        video: {
          mode: "on",
          size: { width: 1440, height: 900 },
        },
      },
    },
    {
      name: "Mobile Showcase",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        hasTouch: true,
        isMobile: true,
        video: {
          mode: "on",
          size: { width: 390, height: 844 },
        },
      },
    },
  ],
  webServer: {
    command: `pnpm --filter @lemonade/web exec vite build --base=${basePath} && pnpm --filter @lemonade/web exec vite preview --host 127.0.0.1 --port 4173 --strictPort --base=${basePath}`,
    url: `${previewOrigin}${basePath}`,
    reuseExistingServer: !isCI,
  },
});
