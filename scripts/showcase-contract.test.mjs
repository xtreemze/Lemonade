import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const read = (file) => readFile(file, "utf8");
const manifest = JSON.parse(await read("e2e/showcase/manifest.json"));

test("showcase manifest defines exactly five durable capabilities and source-appropriate media", () => {
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
  assert.deepEqual(
    manifest.features.map((feature) => feature.media),
    ["video", "screenshot", "video", "screenshot", "screenshot"],
  );
  assert.equal(manifest.capture.videoFps, 60);
  assert.equal(manifest.capture.animatedGraphicFps, 30);
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
  assert.ok(config.includes('video: "off"'));
});

test("showcase specs capture dynamic 3D scenes directly and static states as screenshots", async () => {
  const spec = await read("e2e/showcase/showcase.spec.ts");
  assert.ok(spec.includes("canvas.captureStream(requestedFps)"));
  assert.ok(spec.includes("new MediaRecorder"));
  assert.ok(spec.includes("videoBitsPerSecond"));
  assert.ok(spec.includes("page.screenshot"));
  assert.ok(spec.includes('media === "screenshot"'));
  assert.ok(spec.includes('media === "video"'));
});

test("renderer creates source-quality reels plus mixed PNG and animated WebP presentation assets", async () => {
  const renderer = await read("scripts/render-showcase.mjs");
  assert.ok(renderer.includes("lemonade-desktop-highlight.mp4"));
  assert.ok(renderer.includes("lemonade-mobile-highlight.mp4"));
  assert.ok(renderer.includes("lemonade-desktop-highlight.webp"));
  assert.ok(renderer.includes("lemonade-mobile-highlight.webp"));
  assert.ok(renderer.includes("libwebp_anim"));
  assert.ok(renderer.includes("animatedGraphicFps"));
  assert.ok(renderer.includes('"-loop", "1"'));
  assert.ok(renderer.includes('"-crf",\n    "17"'));
  assert.ok(renderer.includes("flags=lanczos"));
});

test("verifier enforces source resolution and high-frame-rate output", async () => {
  const verifier = await read("scripts/verify-showcase.mjs");
  assert.ok(verifier.includes('"ffprobe"'));
  assert.ok(verifier.includes("assertHighFrameRate"));
  assert.ok(verifier.includes("width: 1440, height: 900"));
  assert.ok(verifier.includes("width: 390, height: 844"));
  assert.ok(verifier.includes("animated WebP"));
  assert.ok(verifier.includes("PNG screenshot"));
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

test("Pages publishes mixed graphics, source videos, and reels at stable paths", async () => {
  const pages = await read(".github/workflows/pages.yml");
  assert.ok(pages.includes("dist/showcase/desktop"));
  assert.ok(pages.includes("dist/showcase/mobile"));
  assert.ok(pages.includes("dist/showcase/videos/desktop"));
  assert.ok(pages.includes("dist/showcase/videos/mobile"));
  assert.ok(pages.includes("dist/showcase/reels"));
  assert.ok(pages.includes("e2e-media/graphics/desktop"));
  assert.ok(pages.includes("e2e-media/videos/desktop"));
});

test("README and docs use animated graphics only for dynamic scenes", async () => {
  const readme = await read("README.md");
  const docs = await read("docs/showcase.md");
  for (const formFactor of ["desktop", "mobile"]) {
    for (const feature of manifest.features) {
      const extension = feature.media === "video" ? "webp" : "png";
      assert.ok(readme.includes(`showcase/${formFactor}/${feature.id}.${extension}`));
    }
    for (const feature of manifest.features.filter((candidate) => candidate.media === "video")) {
      assert.ok(readme.includes(`showcase/videos/${formFactor}/${feature.id}.mp4`));
    }
  }
  assert.ok(readme.includes("lemonade-desktop-highlight.webp"));
  assert.ok(readme.includes("lemonade-mobile-highlight.webp"));
  assert.ok(docs.includes("captureStream(60)"));
  assert.ok(docs.includes("source-resolution H.264 MP4"));
  assert.ok(docs.includes("animated WebP"));
});
