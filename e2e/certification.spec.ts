import { expect, test, type Page } from "@playwright/test";

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

const expectNoViewportOverflow = async (page: Page): Promise<void> => {
  await expectNoHorizontalOverflow(page);
  await expectNoVerticalOverflow(page);
};

test("release artifact completes a day without uncaught runtime failures", async ({ page }) => {
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
  await expect(page.getByRole("slider")).toHaveCount(3);
  await expect(page.locator("#scene-equivalent")).not.toBeEmpty();

  await page.getByRole("button", { name: "Sell for the day" }).click();
  await expect(page.getByRole("button", { name: "Review sales history" })).toBeVisible();
  await page.getByRole("button", { name: "Review sales history" }).click();
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
  await expect(main).toHaveAttribute("data-view", "planning");
  await expectNoViewportOverflow(page);
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
    const thumbStyle = await slider.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        image: style.getPropertyValue("--slider-thumb-image"),
        kind: style.getPropertyValue("--slider-thumb-kind").trim(),
      };
    });
    expect(thumbStyle.kind).toBe(icon);
    expect(thumbStyle.image).toContain("data:image/svg+xml");
  }

  const simulationButton = page.getByRole("button", { name: "Sell for the day" });
  await expect(simulationButton).toBeVisible();
  const buttonBox = await simulationButton.boundingBox();
  if (buttonBox === null) throw new Error("expected simulation button bounds");
  expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(740);

  await simulationButton.click();
  await expect(main).toHaveAttribute("data-view", "simulation");
  await expect(page.locator(".stand-stage")).toBeVisible();
  await expect(page.locator("#scene-equivalent")).toContainText("glasses prepared");
  await expect(page.locator("#scene-canvas")).toHaveAttribute(
    "data-presentation-duration-ms",
    "5000",
  );
  await expectNoViewportOverflow(page);
  const simulationStage = await page.locator(".stand-stage").boundingBox();
  if (simulationStage === null) throw new Error("expected simulation stage bounds");
  expect(simulationStage.width).toBeGreaterThanOrEqual(359);
  expect(simulationStage.height).toBeGreaterThanOrEqual(739);

  await expect(main).toHaveAttribute("data-view", "report");
  await expect(page.getByRole("button", { name: "Review sales history" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Sales history" })).not.toBeVisible();
  await expectNoViewportOverflow(page);

  await page.getByRole("button", { name: "Review sales history" }).click();
  await expect(main).toHaveAttribute("data-view", "history");
  await expect(page.getByRole("region", { name: "Sales history" })).toBeVisible();
  await expect(page.locator(".history-table tbody tr")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Plan next day" })).toBeVisible();
  await expectNoViewportOverflow(page);

  await page.getByRole("button", { name: "Plan next day" }).click();
  await expect(main).toHaveAttribute("data-view", "forecast");
  await expect(page.locator("#scene-title")).not.toBeEmpty();
  await expect(page.locator("#scene-canvas")).toHaveAttribute(
    "data-presentation-duration-ms",
    "3000",
  );
  await expectNoViewportOverflow(page);
  await expect(main).toHaveAttribute("data-view", "planning");
  await expect(page.locator("#status-day")).toHaveText("2");
  await expectNoHorizontalOverflow(page);
});

test("reset requires explicit in-page confirmation", async ({ page }) => {
  await page.goto("./");

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
  await expect(page.getByRole("button", { name: "Review sales history" })).toBeVisible();
});

test("storage failure degrades to a playable in-memory run", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      get() {
        throw new Error("certification-injected IndexedDB failure");
      },
    });
  });

  await page.goto("./");
  await expect(page.locator("#run-error")).toContainText("Unable to open browser run storage");
  await expect(page.getByRole("button", { name: "Sell for the day" })).toBeEnabled();
  await page.getByRole("button", { name: "Sell for the day" }).click();
  await expect(page.getByRole("button", { name: "Review sales history" })).toBeVisible();
});

test("scene runtime failure falls back without blocking gameplay", async ({ page }) => {
  const sceneRequests: string[] = [];
  await page.route(/\/assets\/scene-runtime-[^/]+\.js$/, async (route) => {
    sceneRequests.push(route.request().url());
    await route.abort();
  });

  await page.goto("./");

  await expect(page.getByRole("slider")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Sell for the day" })).toBeEnabled();
  await expect(page.locator("#scene-fallback")).not.toBeVisible();
  expect(sceneRequests).toHaveLength(0);

  await page.getByRole("button", { name: "Sell for the day" }).click();
  await expect(page.getByRole("main")).toHaveAttribute("data-view", "simulation");
  await expect(page.locator("#scene-fallback")).toBeVisible();
  await expect(page.locator("#scene-fallback-description")).not.toBeEmpty();
  expect(sceneRequests).toHaveLength(1);

  await expect(page.getByRole("button", { name: "Review sales history" })).toBeVisible();
});
