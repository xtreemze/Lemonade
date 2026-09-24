import { expect, test } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

test("keyboard focus follows the active phase through the daily loop", async ({ page }) => {
  await page.goto("./", { waitUntil: "domcontentloaded" });

  const main = page.getByRole("main");
  await expect(main).toHaveAttribute("data-view", "planning");

  const glasses = page.getByRole("slider", { name: /Glasses/u });
  await expect(glasses).toBeFocused();

  const exactGlasses = page.locator("#glasses-exact");
  const initialGlasses = Number(await glasses.inputValue());
  await glasses.press("ArrowRight");
  await expect(exactGlasses).toHaveValue(String(initialGlasses + 1));

  const sell = page.getByRole("button", { name: "Sell for the day" });
  await sell.focus();
  await page.keyboard.press("Enter");

  await expect(main).toHaveAttribute("data-view", "report");
  await expect(page.locator("#sell-button")).toBeHidden();

  const reportTitle = page.locator("#report-title");
  await expect(reportTitle).toBeFocused();

  await page.keyboard.press("Tab");
  const reviewHistory = page.getByRole("button", { name: "Review sales history" });
  await expect(reviewHistory).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(main).toHaveAttribute("data-view", "history");
  const history = page.getByRole("region", { name: "Sales history" });
  await expect(history).toBeFocused();

  await page.keyboard.press("Tab");
  const nextDay = page.getByRole("button", { name: "Plan next day" });
  await expect(nextDay).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(main).toHaveAttribute("data-view", "planning");
  await expect(glasses).toBeFocused();
});

test("native reset dialog contains keyboard focus and restores it on cancel", async ({ page }) => {
  await page.goto("./", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("main")).toHaveAttribute("data-view", "planning");

  const runSummary = page.locator(".run-tools-summary");
  await runSummary.focus();
  await page.keyboard.press("Enter");

  const reset = page.getByRole("button", { name: "Reset run" });
  await reset.focus();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog", { name: "Reset this run?" });
  await expect(dialog).toBeVisible();

  const keepRun = page.getByRole("button", { name: "Keep run" });
  await expect(keepRun).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect(dialog.locator(":focus")).toHaveCount(1);

  await keepRun.focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(reset).toBeFocused();
});
