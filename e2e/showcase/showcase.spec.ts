import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import manifest from "./manifest.json";

type Feature = (typeof manifest.features)[number];
type FormFactor = "desktop" | "mobile";

const artifactRoot = path.resolve("artifacts/e2e-media");

const getFeature = (id: string): Feature => {
  const feature = manifest.features.find((candidate) => candidate.id === id);
  if (feature === undefined) {
    throw new Error(`Unknown showcase feature: ${id}`);
  }
  return feature;
};

const getFormFactor = (testInfo: TestInfo): FormFactor => {
  if (testInfo.project.name === "Desktop Showcase") return "desktop";
  if (testInfo.project.name === "Mobile Showcase") return "mobile";
  throw new Error(`Unexpected showcase project: ${testInfo.project.name}`);
};

const addBranding = async (page: Page, feature: Feature, formFactor: FormFactor): Promise<void> => {
  await page.evaluate(
    ({ title, form }) => {
      document.querySelector("#ci-showcase-brand")?.remove();

      const badge = document.createElement("div");
      badge.id = "ci-showcase-brand";
      badge.setAttribute("aria-hidden", "true");
      badge.style.cssText = [
        "position:fixed",
        "top:max(8px, env(safe-area-inset-top))",
        "left:50%",
        "transform:translateX(-50%)",
        "z-index:2147483647",
        "pointer-events:none",
        "display:flex",
        "gap:.55rem",
        "align-items:center",
        "padding:.38rem .62rem",
        "border:1px solid rgba(255,255,255,.38)",
        "border-radius:999px",
        "background:rgba(16,20,24,.72)",
        "backdrop-filter:blur(8px)",
        "color:white",
        "font:600 12px/1.2 system-ui,sans-serif",
        "letter-spacing:.01em",
        "box-shadow:0 2px 12px rgba(0,0,0,.18)",
        "max-width:calc(100vw - 24px)",
        "white-space:nowrap",
      ].join(";");

      const product = document.createElement("strong");
      product.textContent = "Lemonade";
      const separator = document.createElement("span");
      separator.textContent = "·";
      separator.style.opacity = "0.6";
      const featureTitle = document.createElement("span");
      featureTitle.textContent = title;
      const mode = document.createElement("span");
      mode.textContent = form === "mobile" ? "Mobile" : "Desktop";
      mode.style.opacity = "0.72";

      badge.append(product, separator, featureTitle, mode);
      document.body.appendChild(badge);
    },
    { title: feature.title, form: formFactor },
  );
};

const recordFeature = async (
  page: Page,
  testInfo: TestInfo,
  feature: Feature,
  demonstrate: () => Promise<void>,
): Promise<void> => {
  const formFactor = getFormFactor(testInfo);
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error("Showcase viewport must be explicit.");

  const rawDir = path.join(artifactRoot, "raw", formFactor);
  await mkdir(rawDir, { recursive: true });

  await addBranding(page, feature, formFactor);
  const startedAt = Date.now();
  await demonstrate();

  const targetMs = Math.round(feature.durationSeconds * 1_000);
  const elapsedMs = Date.now() - startedAt;
  if (elapsedMs < targetMs) {
    await page.waitForTimeout(targetMs - elapsedMs);
  }

  const screenshotPath = path.join(rawDir, `${feature.id}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });

  const metadata = {
    id: feature.id,
    title: feature.title,
    description: feature.description,
    formFactor,
    viewport,
    trimSeconds: feature.durationSeconds,
  };
  await writeFile(
    path.join(rawDir, `${feature.id}.json`),
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8",
  );

  const video = page.video();
  if (video === null) throw new Error("Showcase project must record video.");
  await page.close();
  await video.saveAs(path.join(rawDir, `${feature.id}.webm`));
};

const openPlanning = async (page: Page, fast = false): Promise<void> => {
  if (fast) {
    await page.emulateMedia({ reducedMotion: "reduce" });
  }
  await page.goto("./", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("main")).toHaveAttribute("data-view", "planning", {
    timeout: 10_000,
  });
  await expect(page.getByRole("slider")).toHaveCount(3);
};

const openReport = async (page: Page): Promise<void> => {
  await openPlanning(page, true);
  await page.getByRole("button", { name: "Sell for the day" }).click();
  await expect(page.getByRole("main")).toHaveAttribute("data-view", "report", {
    timeout: 7_500,
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
};

const openHistory = async (page: Page): Promise<void> => {
  await openReport(page);
  await page.getByRole("button", { name: "Review sales history" }).click();
  await expect(page.getByRole("main")).toHaveAttribute("data-view", "history");
  await expect(page.getByRole("region", { name: "Sales history" })).toBeVisible();
};

test("01-weather-forecast", async ({ page }, testInfo) => {
  const feature = getFeature("01-weather-forecast");
  await page.goto("./", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("main")).toHaveAttribute("data-view", "forecast");
  await expect(page.locator("#scene-canvas")).toHaveAttribute("data-stand-state", "closed", {
    timeout: 4_000,
  });

  await recordFeature(page, testInfo, feature, async () => {
    await expect(page.locator("#scene-canvas")).toHaveAttribute("data-scene-shot", "forecast");
  });
});

test("02-three-decision-plan", async ({ page }, testInfo) => {
  const feature = getFeature("02-three-decision-plan");
  await openPlanning(page);
  const glasses = page.getByRole("slider", { name: /Glasses/u });
  const startValue = await glasses.inputValue();

  await recordFeature(page, testInfo, feature, async () => {
    if (getFormFactor(testInfo) === "desktop") {
      await glasses.focus();
      await page.keyboard.press("ArrowRight");
      await expect(glasses).not.toHaveValue(startValue);
      await page.keyboard.press("ArrowLeft");
      await expect(glasses).toHaveValue(startValue);
      await page.getByRole("button", { name: "Sell for the day" }).hover();
      await page.mouse.move(2, 2);
      return;
    }

    const box = await glasses.boundingBox();
    if (box === null) throw new Error("Expected visible glasses slider.");
    await page.touchscreen.tap(box.x + box.width * 0.72, box.y + box.height / 2);
    await expect(glasses).not.toHaveValue(startValue);
    await glasses.fill(startValue);
    await expect(glasses).toHaveValue(startValue);
  });
});

test("03-lemonsville-simulation", async ({ page }, testInfo) => {
  const feature = getFeature("03-lemonsville-simulation");
  await openPlanning(page);
  await page.getByRole("button", { name: "Sell for the day" }).click();
  await expect(page.getByRole("main")).toHaveAttribute("data-view", "simulation");
  await expect(page.locator("#scene-canvas")).toHaveAttribute("data-stand-state", "open");
  await expect(page.locator("#scene-equivalent")).toContainText("glasses prepared");

  await recordFeature(page, testInfo, feature, async () => {
    await expect(page.locator(".stand-stage")).toBeVisible();
  });
});

test("04-day-report", async ({ page }, testInfo) => {
  const feature = getFeature("04-day-report");
  await openReport(page);
  await expect(page.locator(".results-grid > div")).toHaveCount(4);
  await expect(page.getByRole("button", { name: "Review sales history" })).toBeVisible();

  await recordFeature(page, testInfo, feature, async () => {
    if (getFormFactor(testInfo) === "desktop") {
      await page.locator(".results-grid > div").first().hover();
      await page.mouse.move(2, 2);
    }
  });
});

test("05-sales-history", async ({ page }, testInfo) => {
  const feature = getFeature("05-sales-history");
  await openHistory(page);
  const history = page.getByRole("region", { name: "Sales history" });

  await recordFeature(page, testInfo, feature, async () => {
    if (getFormFactor(testInfo) === "desktop") {
      await history.hover();
      await page.mouse.move(2, 2);
      return;
    }
    const box = await history.boundingBox();
    if (box !== null) {
      await page.touchscreen.tap(box.x + box.width / 2, box.y + Math.min(48, box.height / 2));
    }
  });
});
