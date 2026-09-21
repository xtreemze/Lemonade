import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test("plays a complete day with keyboard controls", async ({ page }) => {
  await page.goto("./");

  const sliders = page.getByRole("slider");
  await expect(sliders).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Sell for the day" })).toHaveCount(1);

  const glasses = page.getByRole("slider", { name: /Glasses/ });
  await expect(page.locator("#glasses-cost")).toHaveText("Cost $5.00");
  await expect(page.locator("#signs-cost")).toHaveText("Cost $0.50");
  await expect(page.locator("#price-value")).toHaveText("Price $1.50 / glass");
  await glasses.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#glasses-cost")).toHaveText("Cost $6.00");

  const sell = page.getByRole("button", { name: "Sell for the day" });
  await sell.focus();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: /sold$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Plan next day" })).toBeVisible();
});

test("supports precise numeric entry synchronized with sliders", async ({ page }) => {
  await page.goto("./");

  const exactInputs = page.getByRole("spinbutton");
  await expect(exactInputs).toHaveCount(3);

  const glassesExact = page.getByRole("spinbutton", { name: "Glasses Exact" });
  const glassesSlider = page.getByRole("slider", { name: "Glasses" });
  await glassesExact.focus();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("14");
  await expect(glassesExact).toHaveValue("14");
  await expect(glassesSlider).toHaveValue("14");
  await expect(page.locator("#glasses-cost")).toHaveText("Cost $14.00");

  const signsExact = page.getByRole("spinbutton", { name: "Signs Exact" });
  const signsSlider = page.getByRole("slider", { name: "Signs" });
  await signsSlider.focus();
  await page.keyboard.press("ArrowRight");
  await expect(signsExact).toHaveValue("2");
  await expect(page.locator("#signs-cost")).toHaveText("Cost $1.00");

  const priceExact = page.getByRole("spinbutton", { name: "Price Exact cents" });
  const priceSlider = page.getByRole("slider", { name: "Price" });
  await priceExact.focus();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("175");
  await expect(priceExact).toHaveValue("175");
  await expect(priceSlider).toHaveValue("15");
  await expect(page.locator("#price-value")).toHaveText("Price $1.75 / glass");

  await glassesExact.fill("9999");
  const maximumGlasses = await glassesSlider.getAttribute("max");
  if (maximumGlasses === null) throw new Error("expected glasses maximum");
  await expect(glassesExact).toHaveValue(maximumGlasses);
  await expect(glassesSlider).toHaveValue(maximumGlasses);
});

test("restores the level-one operating envelope independently of finance", async ({ page }) => {
  await page.goto("./");

  await expect(page.locator("#finance-tier")).toHaveText("Stand level 1 · Business tier 0");
  await expect(page.getByRole("slider", { name: /Glasses/ })).toHaveAttribute("max", "15");
  await expect(page.getByRole("slider", { name: /Signs/ })).toHaveAttribute("max", "3");
  await expect(page.getByRole("slider", { name: /Price/ })).toHaveAttribute("max", "299");
  await expect(page.getByRole("spinbutton", { name: "Price Exact cents" })).toHaveAttribute(
    "max",
    "299",
  );
});

test("restores both report and next-day phases across reloads", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Sell for the day" }).click();

  const reportHeading = page.getByRole("heading", { name: /sold$/ });
  const reportText = await reportHeading.textContent();
  if (reportText === null) throw new Error("expected a day report heading");
  await expect(page.locator("#run-status")).toContainText("Day report saved locally");

  await page.reload();
  await expect(page.getByRole("heading", { name: reportText })).toBeVisible();
  await expect(page.getByRole("button", { name: "Plan next day" })).toBeVisible();

  await page.getByRole("button", { name: "Plan next day" }).click();
  await expect(page.locator("#status-day")).toHaveText("2");
  await expect(page.locator("#run-status")).toContainText("Next day saved locally");

  await page.reload();
  await expect(page.locator("#status-day")).toHaveText("2");
  await expect(page.getByRole("main")).toHaveAttribute("data-view", "planning");
  await expect(page.getByRole("button", { name: "Sell for the day" })).toBeVisible();
  await expect(page.locator("#ledger-history-host")).not.toBeVisible();
});

test("exports and imports a progressed run into a clean browser profile", async ({ browser }) => {
  const baseURL = "http://127.0.0.1:4173/Lemonade/";
  const source = await browser.newContext({ baseURL, acceptDownloads: true });
  const sourcePage = await source.newPage();
  await sourcePage.goto("./");
  await sourcePage.getByRole("button", { name: "Sell for the day" }).click();
  await sourcePage.getByRole("button", { name: "Plan next day" }).click();
  await expect(sourcePage.locator("#status-day")).toHaveText("2");

  await expect(sourcePage.getByRole("main")).toHaveAttribute("data-view", "planning");
  await sourcePage.locator(".run-tools-summary").click();
  const downloadPromise = sourcePage.waitForEvent("download");
  await sourcePage.getByRole("button", { name: "Export run" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  const runDocument = await readFile(downloadPath);

  const target = await browser.newContext({ baseURL });
  const targetPage = await target.newPage();
  await targetPage.goto("./");
  await expect(targetPage.locator("#status-day")).toHaveText("1");

  await targetPage.locator(".run-tools-summary").click();
  const chooserPromise = targetPage.waitForEvent("filechooser");
  await targetPage.getByRole("button", { name: "Import run" }).click();
  const chooser = await chooserPromise;
  const reloadPromise = targetPage.waitForEvent("load");
  await chooser.setFiles({
    name: "lemonade-run.json",
    mimeType: "application/json",
    buffer: runDocument,
  });
  await reloadPromise;

  await expect(targetPage.locator("#status-day")).toHaveText("2");
  await expect(targetPage.getByRole("main")).toHaveAttribute("data-view", "planning");
  await expect(targetPage.locator("#ledger-history-host")).not.toBeVisible();
  await expect(targetPage.getByRole("button", { name: "Sell for the day" })).toBeVisible();

  await target.close();
  await source.close();
});
