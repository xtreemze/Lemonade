import { expect, test, type Page } from "@playwright/test";

const expectNoHorizontalOverflow = async (page: Page): Promise<void> => {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
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
  await expect(page.getByRole("slider")).toHaveCount(3);
  await expect(page.locator("#scene-equivalent")).not.toBeEmpty();

  await page.getByRole("button", { name: "Sell for the day" }).click();
  await expect(page.getByRole("button", { name: "Plan next day" })).toBeVisible();
  await page.getByRole("button", { name: "Plan next day" }).click();
  await expect(page.locator("#status-day")).toHaveText("2");

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("narrow viewport keeps the operating surface contained and data accessible", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("./");

  await expectNoHorizontalOverflow(page);
  await expect(page.getByRole("slider", { name: /Glasses/ })).toBeVisible();
  await expect(page.getByRole("slider", { name: /Signs/ })).toBeVisible();
  await expect(page.getByRole("slider", { name: /Price/ })).toBeVisible();

  await page.getByRole("button", { name: "Sell for the day" }).click();
  const history = page.getByRole("region", { name: "Sales history" });
  await expect(history).toBeVisible();
  await expect(
    history.getByRole("table", {
      name: "Complete values represented by the sales-history charts and finance ledger",
    }),
  ).toBeVisible();
  await expect(history.getByRole("img")).toHaveCount(2);
  await expectNoHorizontalOverflow(page);
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
  await expect(page.getByRole("button", { name: "Plan next day" })).toBeVisible();
});
