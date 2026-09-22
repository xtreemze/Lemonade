import { expect, test } from "@playwright/test";

test("shows a weekly report after each completed seven-day cycle", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  await expect(page.getByRole("main")).toHaveAttribute("data-view", "planning");

  for (let day = 1; day <= 7; day += 1) {
    await page.locator("#glasses-exact").fill("0");
    await page.locator("#signs-exact").fill("0");
    await page.getByRole("button", { name: "Sell for the day" }).click();
    await expect(page.getByRole("main")).toHaveAttribute("data-view", "report");

    if (day < 7) {
      await expect(page.getByRole("heading", { name: /Week \d+ results/ })).toHaveCount(0);
      await page.getByRole("button", { name: "Plan next day" }).click();
      await expect(page.locator("#status-day")).toHaveText(String(day + 1));
      await expect(page.getByRole("main")).toHaveAttribute("data-view", "planning");
    }
  }

  await expect(page.getByRole("heading", { name: "Week 1 results" })).toBeVisible();
  await expect(page.locator(".weekly-report .eyebrow")).toContainText("Days 1–7");
  await expect(page.locator(".weekly-results-grid")).toContainText("Revenue");
  await expect(page.locator(".weekly-results-grid")).toContainText("Sell-through");
  await expect(page.locator(".weekly-highlights")).toContainText("Best day");
  await expect(page.locator(".weekly-highlights")).toContainText("Lowest day");

  const viewportContract = await page.evaluate(() => {
    const shell = document.querySelector(".game-shell");
    const report = document.querySelector(".report-panel");
    if (!(shell instanceof HTMLElement) || !(report instanceof HTMLElement)) {
      throw new TypeError("Expected report viewport elements.");
    }

    const shellRect = shell.getBoundingClientRect();
    const reportRect = report.getBoundingClientRect();
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      document: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        clientWidth: document.documentElement.clientWidth,
        clientHeight: document.documentElement.clientHeight,
      },
      shell: {
        left: shellRect.left,
        top: shellRect.top,
        right: shellRect.right,
        bottom: shellRect.bottom,
      },
      report: {
        clientHeight: report.clientHeight,
        scrollHeight: report.scrollHeight,
        left: reportRect.left,
        top: reportRect.top,
        right: reportRect.right,
        bottom: reportRect.bottom,
      },
      htmlOverflow: getComputedStyle(document.documentElement).overflow,
      bodyOverflow: getComputedStyle(document.body).overflow,
    };
  });

  expect(viewportContract.document.width).toBeLessThanOrEqual(
    viewportContract.document.clientWidth + 1,
  );
  expect(viewportContract.document.height).toBeLessThanOrEqual(
    viewportContract.document.clientHeight + 1,
  );
  expect(viewportContract.report.scrollHeight).toBeLessThanOrEqual(
    viewportContract.report.clientHeight + 1,
  );
  expect(viewportContract.htmlOverflow).toBe("hidden");
  expect(viewportContract.bodyOverflow).toBe("hidden");
  expect(viewportContract.shell.left).toBeGreaterThanOrEqual(-1);
  expect(viewportContract.shell.top).toBeGreaterThanOrEqual(-1);
  expect(viewportContract.shell.right).toBeLessThanOrEqual(viewportContract.viewport.width + 1);
  expect(viewportContract.shell.bottom).toBeLessThanOrEqual(viewportContract.viewport.height + 1);
  expect(viewportContract.report.left).toBeGreaterThanOrEqual(-1);
  expect(viewportContract.report.top).toBeGreaterThanOrEqual(-1);
  expect(viewportContract.report.right).toBeLessThanOrEqual(viewportContract.viewport.width + 1);
  expect(viewportContract.report.bottom).toBeLessThanOrEqual(viewportContract.viewport.height + 1);
});
