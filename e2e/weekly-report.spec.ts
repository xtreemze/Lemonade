import { expect, test } from "@playwright/test";

test("shows a weekly report after each completed seven-day cycle", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");

  for (let day = 1; day <= 7; day += 1) {
    await page.locator("#glasses-exact").fill("0");
    await page.locator("#signs-exact").fill("0");
    await page.getByRole("button", { name: "Sell for the day" }).click();

    if (day < 7) {
      await expect(page.getByRole("heading", { name: /Week \d+ results/ })).toHaveCount(0);
      await page.getByRole("button", { name: "Plan next day" }).click();
      await expect(page.locator("#status-day")).toHaveText(String(day + 1));
    }
  }

  await expect(page.getByRole("heading", { name: "Week 1 results" })).toBeVisible();
  await expect(page.locator(".weekly-report .eyebrow")).toContainText("Days 1–7");
  await expect(page.locator(".weekly-results-grid")).toContainText("Revenue");
  await expect(page.locator(".weekly-results-grid")).toContainText("Sell-through");
  await expect(page.locator(".weekly-highlights")).toContainText("Best day");
  await expect(page.locator(".weekly-highlights")).toContainText("Lowest day");
});
