import { expect, test } from "@playwright/test";

test("Babylon migration runtime boots through the lazy scene boundary", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    window.localStorage.setItem("LEMONADE_SCENE_BACKEND", "babylon");
  });
  await page.goto("./");

  const canvas = page.locator("#scene-canvas");
  await expect(canvas).toHaveAttribute("data-renderer-backend", "babylon", {
    timeout: 5_000,
  });
  await expect(canvas).not.toHaveClass(/scene-canvas-hidden/u);
  await expect(page.locator("#scene-fallback")).toBeHidden();

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
