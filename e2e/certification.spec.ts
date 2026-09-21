import { expect, test, type Page } from "@playwright/test";

const FORECAST_PRESENTATION_MS = 6_000;
const SIMULATION_PRESENTATION_MS = 10_000;
const PHASE_SETTLE_MARGIN_MS = 2_000;

const expectPlanningReady = async (page: Page): Promise<void> => {
  await expect(page.getByRole("main")).toHaveAttribute("data-view", "planning", {
    timeout: FORECAST_PRESENTATION_MS + PHASE_SETTLE_MARGIN_MS,
  });
};

const expectNoHorizontalOverflow = async (page: Page): Promise<void> => {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
};

const expectNoVerticalOverflow = async (page: Page): Promise<void> => {
  const dimensions = await page.evaluate(() => ({
    clientHeight: document.documentElement.clientHeight,
    scrollHeight: document.documentElement.scrollHeight,
  }));
  expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.clientHeight + 1);
};

test("release artifact completes a day without uncaught runtime failures", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await page.goto("./");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lemonade", level: 1 })).toBeVisible();
  const litComponents = page.locator(
    "lemonade-run-tools, lemonade-decision-panel, lemonade-day-report",
  );
  await expect(litComponents).toHaveCount(3);
  expect(
    await litComponents.evaluateAll((elements) =>
      elements.every((element) => element.shadowRoot === null),
    ),
  ).toBe(true);
  await expectPlanningReady(page);
  await expect(page.getByRole("slider")).toHaveCount(3);
  await expect(page.locator("#scene-equivalent")).not.toBeEmpty();

  await page.getByRole("button", { name: "Sell for the day" }).click();
  await expect(page.getByRole("button", { name: "Plan next day" })).toBeVisible();
  await page.getByRole("button", { name: "Plan next day" }).click();
  await expect(page.locator("#status-day")).toHaveText("2");

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("narrow viewport keeps the complete planning surface above the fold", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("./");

  const main = page.getByRole("main");
  await expect(main).toHaveAttribute("data-view", "forecast");
  await expect(page.locator("#scene-canvas")).toHaveAttribute(
    "data-presentation-duration-ms",
    String(FORECAST_PRESENTATION_MS),
  );
  await expectNoHorizontalOverflow(page);
  await expectNoVerticalOverflow(page);
  await expectPlanningReady(page);
  await expect(page.getByRole("slider", { name: /Glasses/ })).toBeVisible();
  await expect(page.getByRole("slider", { name: /Signs/ })).toBeVisible();
  await expect(page.getByRole("slider", { name: /Price/ })).toBeVisible();
  await expect(page.getByRole("spinbutton")).toHaveCount(0);

  for (const [name, icon] of [
    ["Glasses", "cup"],
    ["Signs", "sign"],
    ["Price", "usd"],
  ] as const) {
    const slider = page.getByRole("slider", { name: new RegExp(name) });
    const control = slider.locator("xpath=..");
    const sliderBox = await slider.boundingBox();
    const controlBox = await control.boundingBox();
    if (sliderBox === null || controlBox === null) {
      throw new Error(`expected ${name} slider bounds`);
    }
    expect(sliderBox.width).toBeGreaterThanOrEqual(controlBox.width * 0.95);
    expect(sliderBox.height).toBeGreaterThanOrEqual(56);
    const thumbStyle = await slider.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        image: style.getPropertyValue("--slider-thumb-image"),
        kind: style.getPropertyValue("--slider-thumb-kind").trim(),
      };
    });
    expect(thumbStyle.kind).toBe(icon);
    expect(thumbStyle.image).toContain(icon);
    expect(thumbStyle.image).toContain(".svg");
  }

  const simulationButton = page.getByRole("button", { name: "Sell for the day" });
  await expect(simulationButton).toBeVisible();
  await expectNoVerticalOverflow(page);

  const buttonBox = await simulationButton.boundingBox();
  if (buttonBox === null) throw new Error("expected simulation button bounds");
  expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(740);
  expect(740 - (buttonBox.y + buttonBox.height)).toBeLessThanOrEqual(24);

  const simulationArt = page.locator(".simulation-button-art");
  await expect(simulationArt).toBeVisible();
  const artContract = await simulationArt.evaluate(async (image) => {
    if (!(image instanceof HTMLImageElement)) throw new TypeError("expected simulation art image");
    await image.decode();
    const response = await fetch(image.src);
    const markup = await response.text();
    return {
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      clipsIce: markup.includes('clip-path="url(#glass-clip)"'),
      floatsIce: markup.includes("ice-float"),
      floatsStraw: markup.includes("straw-float"),
      pours: markup.includes("pour-stream") && markup.includes("@keyframes pour"),
    };
  });
  expect(artContract.naturalWidth).toBeGreaterThan(0);
  expect(artContract.naturalHeight).toBeGreaterThan(0);
  expect(artContract.clipsIce).toBe(true);
  expect(artContract.floatsIce).toBe(true);
  expect(artContract.floatsStraw).toBe(true);
  expect(artContract.pours).toBe(true);
  expect((await simulationButton.textContent())?.trim()).toBe("");

  await simulationButton.click();
  await expect(main).toHaveAttribute("data-view", "simulation");
  await expect(page.locator(".stand-stage")).toBeVisible();
  await expect(page.locator("#scene-equivalent")).toContainText("glasses prepared");
  await expect(page.locator("#scene-canvas")).toHaveAttribute(
    "data-presentation-duration-ms",
    String(SIMULATION_PRESENTATION_MS),
  );
  const simulationStage = await page.locator(".stand-stage").boundingBox();
  if (simulationStage === null) throw new Error("expected simulation stage bounds");
  expect(simulationStage.width).toBeGreaterThanOrEqual(359);
  expect(simulationStage.height).toBeGreaterThanOrEqual(739);
  await expect(main).toHaveAttribute("data-view", "report", {
    timeout: SIMULATION_PRESENTATION_MS + PHASE_SETTLE_MARGIN_MS,
  });
  await expectNoHorizontalOverflow(page);
  await expectNoVerticalOverflow(page);
  await expect(page.getByRole("region", { name: "Sales history" })).toBeHidden();

  const nextDayButton = page.getByRole("button", { name: "Plan next day" });
  await expect(nextDayButton).toBeVisible();
  expect((await nextDayButton.textContent())?.trim()).toBe("");
  await expect(nextDayButton.locator("svg")).toHaveCount(1);
  const nextDayBox = await nextDayButton.boundingBox();
  if (nextDayBox === null) throw new Error("expected next-day control bounds");
  expect(Math.abs(nextDayBox.x + nextDayBox.width / 2 - 180)).toBeLessThanOrEqual(2);
  expect(740 - (nextDayBox.y + nextDayBox.height)).toBeLessThanOrEqual(24);

  await nextDayButton.locator("svg").click();
  await expect(main).toHaveAttribute("data-view", "forecast");
  await expectNoHorizontalOverflow(page);
  await expectNoVerticalOverflow(page);
  await expect(page.locator("#scene-title")).not.toBeEmpty();
  await expect(page.locator("#scene-canvas")).toHaveAttribute(
    "data-presentation-duration-ms",
    String(FORECAST_PRESENTATION_MS),
  );
  await expectPlanningReady(page);
  await expect(page.locator("#status-day")).toHaveText("2");
  await expectNoHorizontalOverflow(page);
  await expectNoVerticalOverflow(page);
});

test("mobile landscape uses the full viewport without scrolling", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 740, height: 360 });
  await page.goto("./");

  const main = page.getByRole("main");
  await expect(main).toHaveAttribute("data-view", "planning");
  await expectNoHorizontalOverflow(page);
  await expectNoVerticalOverflow(page);

  const sliders = page.getByRole("slider");
  await expect(sliders).toHaveCount(3);
  for (let index = 0; index < 3; index += 1) {
    await expect(sliders.nth(index)).toBeVisible();
  }

  const action = page.getByRole("button", { name: "Sell for the day" });
  await expect(action).toBeVisible();
  expect((await action.textContent())?.trim()).toBe("");
  const actionBox = await action.boundingBox();
  if (actionBox === null) throw new Error("expected landscape action bounds");
  expect(360 - (actionBox.y + actionBox.height)).toBeLessThanOrEqual(18);
});

test("reset requires explicit in-page confirmation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  await expectPlanningReady(page);

  await page.locator(".run-tools-summary").click();
  await page.getByRole("button", { name: "Reset run" }).click();
  const dialog = page.getByRole("dialog", { name: "Reset this run?" });
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "Keep run" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Lemonade", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "Reset run" }).click();
  await dialog.getByRole("button", { name: "Reset run" }).click();
  await expect(page.getByRole("heading", { name: "Lemonade", level: 1 })).toBeVisible();
});

test("reduced-motion preference collapses decorative transition and animation durations", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");

  await expect
    .poll(() => page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches))
    .toBe(true);

  const durations = await page.getByRole("button", { name: "Sell for the day" }).evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      animationSeconds: Number.parseFloat(style.animationDuration),
      transitionSeconds: Number.parseFloat(style.transitionDuration),
    };
  });

  expect(durations.animationSeconds).toBeLessThanOrEqual(0.001);
  expect(durations.transitionSeconds).toBeLessThanOrEqual(0.001);
  await page.getByRole("button", { name: "Sell for the day" }).click();
  await expect(page.getByRole("button", { name: "Plan next day" })).toBeVisible();
});

test("storage failure degrades to a playable in-memory run", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      get() {
        throw new Error("certification-injected IndexedDB failure");
      },
    });
  });

  await page.goto("./");
  await expectPlanningReady(page);
  await expect(page.locator("#run-error")).toContainText("Unable to open browser run storage");
  await expect(page.getByRole("button", { name: "Sell for the day" })).toBeEnabled();
  await page.getByRole("button", { name: "Sell for the day" }).click();
  await expect(page.getByRole("button", { name: "Plan next day" })).toBeVisible();
});

test("scene runtime failure falls back without blocking gameplay", async ({ page }) => {
  const sceneRequests: string[] = [];
  await page.route(/\/assets\/scene-runtime-[^/]+\.js$/, async (route) => {
    sceneRequests.push(route.request().url());
    await route.abort();
  });

  await page.goto("./");

  await expect(page.getByRole("main")).toHaveAttribute("data-view", "forecast");
  await expect(page.locator("#scene-fallback")).toBeVisible();
  expect(sceneRequests).toHaveLength(1);
  await expectPlanningReady(page);

  await expect(page.getByRole("slider")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Sell for the day" })).toBeEnabled();

  await page.getByRole("button", { name: "Sell for the day" }).click();
  await expect(page.getByRole("main")).toHaveAttribute("data-view", "simulation");
  await expect(page.locator("#scene-fallback")).toBeVisible();
  await expect(page.locator("#scene-fallback-description")).not.toBeEmpty();
  expect(sceneRequests).toHaveLength(1);

  await expect(page.getByRole("button", { name: "Plan next day" })).toBeVisible({
    timeout: SIMULATION_PRESENTATION_MS + PHASE_SETTLE_MARGIN_MS,
  });
});
