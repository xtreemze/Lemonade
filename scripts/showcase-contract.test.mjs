import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const read = (file) => readFile(file, "utf8");
const manifest = JSON.parse(await read("e2e/showcase/manifest.json"));

test("showcase manifest defines exactly five durable capabilities", () => {
  assert.equal(manifest.features.length, 5);
  assert.deepEqual(
    manifest.features.map((feature) => feature.id),
    [
      "01-weather-forecast",
      "02-three-decision-plan",
      "03-lemonsville-simulation",
      "04-day-report",
      "05-sales-history",
    ],
  );
});

test("normal E2E discovery excludes showcase specs", async () => {
  const config = await read("playwright.config.ts");
  assert.ok(config.includes('testIgnore: ["**/showcase/**"]'));
});

test("showcase config structurally separates desktop and mobile Chromium capture", async () => {
  const config = await read("playwright.showcase.config.ts");
  assert.ok(config.includes('name: "Desktop Showcase"'));
  assert.ok(config.includes('name: "Mobile Showcase"'));
  assert.ok(config.includes("width: 1440, height: 900"));
  assert.ok(config.includes("width: 390, height: 844"));
  assert.ok(config.includes("hasTouch: true"));
  assert.ok(config.includes("video: {"));
});

test("showcase specs persist raw browser video, screenshots, and metadata", async () => {
  const spec = await read("e2e/showcase/showcase.spec.ts");
  assert.ok(spec.includes("video.saveAs"));
  assert.ok(spec.includes("page.screenshot"));
  assert.ok(spec.includes("trimSeconds"));
});

test("renderer creates both reels and optimized infinite-loop GIFs", async () => {
  const renderer = await read("scripts/render-showcase.mjs");
  assert.ok(renderer.includes("lemonade-desktop-highlight.mp4"));
  assert.ok(renderer.includes("lemonade-mobile-highlight.mp4"));
  assert.ok(renderer.includes("palettegen"));
  assert.ok(renderer.includes("paletteuse"));
  assert.ok(renderer.includes('"-loop"'));
  assert.ok(renderer.includes('"0"'));
  assert.ok(renderer.includes("flags=lanczos"));
});

test("dedicated showcase workflow is independently runnable and uploads evidence", async () => {
  const workflow = await read(".github/workflows/showcase.yml");
  assert.ok(workflow.includes("workflow_dispatch:"));
  assert.ok(workflow.includes("concurrency:"));
  assert.ok(workflow.includes("playwright install --with-deps chromium"));
  assert.ok(workflow.includes("ffmpeg"));
  assert.ok(workflow.includes("actions/upload-artifact"));
  assert.ok(workflow.includes("artifacts/e2e-media"));
});

test("Pages publishes stable desktop, mobile, and reel paths", async () => {
  const pages = await read(".github/workflows/pages.yml");
  assert.ok(pages.includes("dist/showcase/desktop"));
  assert.ok(pages.includes("dist/showcase/mobile"));
  assert.ok(pages.includes("dist/showcase/reels"));
});

test("README and docs reference published desktop and mobile imagery", async () => {
  const readme = await read("README.md");
  const docs = await read("docs/showcase.md");
  for (const feature of manifest.features) {
    assert.ok(readme.includes(`showcase/desktop/${feature.id}.gif`));
    assert.ok(readme.includes(`showcase/mobile/${feature.id}.gif`));
  }
  assert.ok(docs.includes("showcase/desktop/03-lemonsville-simulation.gif"));
  assert.ok(docs.includes("showcase/mobile/03-lemonsville-simulation.gif"));
  assert.ok(docs.includes("lemonade-desktop-highlight.mp4"));
  assert.ok(docs.includes("lemonade-mobile-highlight.mp4"));
});
