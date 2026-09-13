import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test("plays a complete day with keyboard controls", async ({ page }) => {
  await page.goto("./");

  const sliders = page.getByRole("slider");
  await expect(sliders).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Sell for the day" })).toHaveCount(1);

  const glasses = page.getByRole("slider", { name: /Glasses/ });
  await glasses.focus();
  await page.keyboard.press("ArrowRight");

  const sell = page.getByRole("button", { name: "Sell for the day" });
  await sell.focus();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: /sold$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Plan next day" })).toBeVisible();
});

test("prevents an unaffordable plan before submission", async ({ page }) => {
  await page.goto("./");

  const glasses = page.getByRole("slider", { name: /Glasses/ });
  const signs = page.getByRole("slider", { name: /Signs/ });
  await glasses.focus();
  await page.keyboard.press("End");
  await signs.focus();
  await page.keyboard.press("End");

  await expect(page.getByRole("alert")).toContainText("available cash and credit");
  await expect(page.getByRole("button", { name: "Sell for the day" })).toBeDisabled();
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
  await expect(page.getByRole("button", { name: "Sell for the day" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sales history" })).toBeVisible();
});

test("exports and imports a progressed run into a clean browser profile", async ({ browser }) => {
  const baseURL = "http://127.0.0.1:4173/Lemonade/";
  const source = await browser.newContext({ baseURL, acceptDownloads: true });
  const sourcePage = await source.newPage();
  await sourcePage.goto("./");
  await sourcePage.getByRole("button", { name: "Sell for the day" }).click();
  await sourcePage.getByRole("button", { name: "Plan next day" }).click();
  await expect(sourcePage.locator("#status-day")).toHaveText("2");

  const downloadPromise = sourcePage.waitForEvent("download");
  await sourcePage.getByRole("button", { name: "Export run" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  const runDocument = await readFile(downloadPath);

  const target = await browser.newContext({ baseURL });
  const targetPage = await target.newPage();
  await targetPage.goto("./");
  await expect(targetPage.locator("#status-day")).toHaveText("1");

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
  await expect(targetPage.getByRole("heading", { name: "Sales history" })).toBeVisible();
  await expect(targetPage.getByRole("button", { name: "Sell for the day" })).toBeVisible();

  await target.close();
  await source.close();
});
