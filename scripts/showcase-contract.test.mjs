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
  assert.match(config, /testIgnore:\\s*\\["\\*\\*\\/showcase\\/\\*\\*"\\]/u);
});

test("showcase config structurally separates desktop and mobile Chromium capture", async () => {
  const config = await read("playwright.showcase.config.ts");
  assert.match(config, /Desktop Showcase/u);
  assert.match(config, /Mobile Showcase/u);
  assert.match(config, /width:\\s*1440,\\s*height:\\s*900/u);
  assert.match(config, /width:\\s*390,\\s*height:\\s*844/u);
  assert.match(config, /hasTouch:\\s*true/u);
  assert.match(config, /video:\\s*\\{/u);
});

test("showcase specs persist raw browser video, screenshots, and metadata", async () => {
  const spec = await read("e2e/showcase/showcase.spec.ts");
  assert.match(spec, /video\\.saveAs/u);
  assert.match(spec, /page\\.screenshot/u);
  assert.match(spec, /trimSeconds/u);
});

test("renderer creates both reels and optimized infinite-loop GIFs", async () => {
  const renderer = await read("scripts/render-showcase.mjs");
  assert.match(renderer, /lemonade-desktop-highlight\\.mp4/u);
  assert.match(renderer, /lemonade-mobile-highlight\\.mp4/u);
  assert.match(renderer, /palettegen/u);
  assert.match(renderer, /paletteuse/u);
  assert.match(renderer, /"-loop",\\s*"0"/u);
  assert.match(renderer, /flags=lanczos/u);
});

test("dedicated showcase workflow is independently runnable and uploads evidence", async () => {
  const workflow = await read(".github/workflows/showcase.yml");
  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(workflow, /concurrency:/u);
  assert.match(workflow, /playwright install --with-deps chromium/u);
  assert.match(workflow, /ffmpeg/u);
  assert.match(workflow, /actions\\/upload-artifact/u);
  assert.match(workflow, /artifacts\\/e2e-media/u);
});

test("Pages publishes stable desktop, mobile, and reel paths", async () => {
  const pages = await read(".github/workflows/pages.yml");
  assert.match(pages, /dist\\/showcase\\/desktop/u);
  assert.match(pages, /dist\\/showcase\\/mobile/u);
  assert.match(pages, /dist\\/showcase\\/reels/u);
});

test("README and docs reference published desktop and mobile imagery", async () => {
  const readme = await read("README.md");
  const docs = await read("docs/showcase.md");
  for (const feature of manifest.features) {
    assert.match(readme, new RegExp(`showcase/desktop/${feature.id}\\\\.gif`, "u"));
    assert.match(readme, new RegExp(`showcase/mobile/${feature.id}\\\\.gif`, "u"));
  }
  assert.match(docs, /showcase\\/desktop\\/03-lemonsville-simulation\\.gif/u);
  assert.match(docs, /showcase\\/mobile\\/03-lemonsville-simulation\\.gif/u);
  assert.match(docs, /lemonade-desktop-highlight\\.mp4/u);
  assert.match(docs, /lemonade-mobile-highlight\\.mp4/u);
});
