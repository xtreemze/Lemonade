import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
  assert.equal(manifest.capture.minimumVideoFps, 30);
  assert.deepEqual(manifest.capture.videoFpsCandidates, [120, 90, 60, 30]);
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
  assert.ok(config.includes("timeout: 120_000"));
  assert.ok(config.includes("--autoplay-policy=no-user-gesture-required"));
  assert.ok(config.includes("--disable-background-timer-throttling"));
  assert.ok(!config.includes("--disable-frame-rate-limit"));
  assert.ok(!config.includes("--disable-gpu-vsync"));
});

test("showcase specs capture dynamic 3D scenes directly and static states as screenshots", async () => {
  const spec = await read("e2e/showcase/showcase.spec.ts");
  assert.ok(!spec.includes("canvas.captureStream(requestedFps)"));
  assert.ok(spec.includes("new VideoEncoder"));
  assert.ok(spec.includes("new VideoFrame"));
  assert.ok(spec.includes("page.clock.install({ time: showcaseClockStart })"));
  assert.ok(spec.includes("page.clock.pauseAt"));
  assert.ok(spec.includes("measureCaptureProfile"));
  assert.ok(spec.includes("videoFpsCandidates.find"));
  assert.ok(spec.includes("measuredAnimationFrameFps"));
  assert.ok(spec.includes("Math.round(1000 / captureProfile.fps)"));
  assert.ok(spec.includes("page.clock.runFor(nextMs - previousMs)"));
  assert.ok(spec.includes('"deterministic-webcodecs-vp8"'));
  assert.ok(spec.includes('"vp8"'));
  assert.ok(spec.includes("videoBitsPerSecond"));
  assert.ok(spec.includes("audioBitsPerSecond"));
  assert.ok(spec.includes("getAudioTracks"));
  assert.ok(spec.includes(".audio.webm"));
  assert.ok(spec.includes("new MediaRecorder"));
  assert.ok(spec.includes("createMediaStreamDestination"));
  assert.ok(spec.includes("AudioNode.prototype"));
  assert.ok(spec.includes("__lemonadeShowcaseAudio"));
  assert.ok(spec.includes("page.screenshot"));
  assert.ok(spec.includes('media === "screenshot"'));
  assert.ok(spec.includes('media === "video"'));
});

test("showcase frame capture waits for the source-sized WebGL canvas", async () => {
  const spec = await read("e2e/showcase/showcase.spec.ts");
  assert.ok(spec.includes("waitForShowcaseCanvasSize"));
  assert.ok(spec.includes("await waitForShowcaseCanvasSize(page, expectedSize)"));
});

test("scene launcher exposes each active preview phase to the render shell", async () => {
  const app = await read("apps/web/src/app.ts");
  assert.match(
    app,
    /this\.#elements\.gameShell\.dataset\["view"\]\s*=\s*preset\.phase\s*===\s*"idle"\s*\?\s*"planning"\s*:\s*preset\.phase;/u,
  );
});

test("renderer creates source-quality reels plus mixed PNG and animated WebP presentation assets", async () => {
  const renderer = await read("scripts/render-showcase.mjs");
  assert.ok(renderer.includes("lemonade-desktop-highlight.mp4"));
  assert.ok(renderer.includes("lemonade-mobile-highlight.mp4"));
  assert.ok(renderer.includes("lemonade-desktop-highlight.webp"));
  assert.ok(renderer.includes("lemonade-mobile-highlight.webp"));
  assert.ok(renderer.includes("libwebp_anim"));
  assert.ok(renderer.includes("readCaptureProfile"));
  assert.ok(renderer.includes("captureProfile.fps"));
  assert.ok(renderer.includes("const encodeStaticClip"));
  assert.ok(renderer.includes('"-crf",\n    "17"'));
  assert.ok(renderer.includes('"-fps_mode"'));
  assert.ok(renderer.includes('"passthrough"'));
  assert.ok(!renderer.includes("fps="));
  assert.ok(!renderer.includes("scale="));
  assert.ok(!renderer.includes("graphicWidth"));
  assert.ok(renderer.includes('"1:a:0"'));
  assert.ok(renderer.includes("anullsrc=channel_layout=stereo:sample_rate=48000"));
  assert.ok(renderer.includes("concat=n="));
  assert.ok(renderer.includes(":v=1:a=1[outv][outa]"));
  assert.ok(renderer.includes('"aac"'));
  assert.ok(renderer.includes('"192k"'));
});

test("verifier enforces source resolution and high-frame-rate output", async () => {
  const verifier = await read("scripts/verify-showcase.mjs");
  assert.ok(verifier.includes('"ffprobe"'));
  assert.ok(verifier.includes("assertFrameProfile"));
  assert.ok(verifier.includes("assertCapturedFrameCadence"));
  assert.ok(verifier.includes("no duplication or interpolation"));
  assert.ok(verifier.includes("metadata.measuredAnimationFrameFps"));
  assert.ok(verifier.includes("best_effort_timestamp_time"));
  assert.ok(verifier.includes("expected exactly"));
  assert.ok(verifier.includes('"deterministic-webcodecs-vp8"'));
  assert.ok(verifier.includes("metadata.capturedFrames"));
  assert.ok(verifier.includes("first="));
  assert.ok(verifier.includes("last="));
  assert.ok(verifier.includes("min="));
  assert.ok(verifier.includes("max="));
  assert.ok(verifier.includes("width: 1440, height: 900"));
  assert.ok(verifier.includes("width: 390, height: 844"));
  assert.ok(verifier.includes("animated WebP"));
  assert.ok(verifier.includes("PNG screenshot"));
  assert.ok(verifier.includes("assertAudio"));
  assert.ok(verifier.includes("assertAudible"));
  assert.ok(verifier.includes("volumedetect"));
  assert.ok(verifier.includes("48000 Hz"));
});

test("showcase harness mirrors application Web Audio without production hooks", async () => {
  const spec = await read("e2e/showcase/showcase.spec.ts");
  assert.ok(spec.includes("class ShowcaseAudioContext extends NativeAudioContext"));
  assert.ok(spec.includes("captureByContext"));
  assert.ok(spec.includes("Reflect.apply(nativeConnect"));
  assert.ok(spec.includes("sampleRate: 48_000"));
});

test("dedicated showcase workflow is independently runnable and uploads evidence", async () => {
  const workflow = await read(".github/workflows/showcase.yml");
  assert.ok(workflow.includes("workflow_dispatch:"));
  assert.ok(workflow.includes("concurrency:"));
  assert.ok(workflow.includes("playwright install --with-deps chromium"));
  assert.ok(workflow.includes("ffmpeg"));
  assert.ok(workflow.includes("actions/upload-artifact"));
  assert.ok(workflow.includes("if: always()"));
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
  assert.ok(docs.includes("WebCodecs"));
  assert.ok(docs.includes("source-frame-rate probe"));
  assert.ok(docs.includes("source-resolution H.264/AAC MP4"));
  assert.ok(docs.includes("animated WebP"));
});
