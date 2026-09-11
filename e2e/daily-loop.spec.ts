import { expect, test } from "@playwright/test";

test("plays a complete day with keyboard controls", async ({ page }) => {
  await page.goto("/");

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
  await page.goto("/");

  const glasses = page.getByRole("slider", { name: /Glasses/ });
  const signs = page.getByRole("slider", { name: /Signs/ });
  await glasses.focus();
  await page.keyboard.press("End");
  await signs.focus();
  await page.keyboard.press("End");

  await expect(page.getByRole("alert")).toContainText("available cash and credit");
  await expect(page.getByRole("button", { name: "Sell for the day" })).toBeDisabled();
});
