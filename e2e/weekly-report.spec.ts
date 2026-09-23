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
      await page.getByRole("button", { name: "Review sales history" }).click();
      await expect(page.getByRole("main")).toHaveAttribute("data-view", "history");
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
  await expect(page.getByRole("button", { name: "Review sales history" })).toBeVisible();

  const responsiveViewports = [
    { name: "compact phone", width: 320, height: 568, dailyColumns: 2, weeklyColumns: 2 },
    { name: "phone portrait", width: 360, height: 740, dailyColumns: 2, weeklyColumns: 2 },
    { name: "phone landscape", width: 740, height: 360, dailyColumns: 4, weeklyColumns: 4 },
    { name: "tablet", width: 1024, height: 768, dailyColumns: 4, weeklyColumns: 4 },
  ] as const;

  for (const viewport of responsiveViewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    const layout = await page.evaluate(() => {
      const shell = document.querySelector(".game-shell");
      const report = document.querySelector(".report-panel");
      const reportContent = document.querySelector(".report-content");
      const dailyResults = document.querySelector(".results-grid");
      const ledger = document.querySelector(".ledger-breakdown");
      const weeklyResults = document.querySelector(".weekly-results-grid");
      const weekly = document.querySelector(".weekly-report");
      const action = document.querySelector("#review-history-button");

      if (
        !(shell instanceof HTMLElement) ||
        !(report instanceof HTMLElement) ||
        !(reportContent instanceof HTMLElement) ||
        !(dailyResults instanceof HTMLElement) ||
        !(ledger instanceof HTMLElement) ||
        !(weeklyResults instanceof HTMLElement) ||
        !(weekly instanceof HTMLElement) ||
        !(action instanceof HTMLElement)
      ) {
        throw new TypeError("Expected complete responsive report structure.");
      }

      const columnCount = (element: HTMLElement): number =>
        getComputedStyle(element).gridTemplateColumns
          .trim()
          .split(/\s+/u)
          .filter(Boolean).length;

      const bounds = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        };
      };

      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        document: {
          width: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight,
          clientWidth: document.documentElement.clientWidth,
          clientHeight: document.documentElement.clientHeight,
        },
        shell: bounds(shell),
        report: {
          ...bounds(report),
          clientHeight: report.clientHeight,
          scrollHeight: report.scrollHeight,
        },
        reportContent: {
          ...bounds(reportContent),
          clientHeight: reportContent.clientHeight,
          scrollHeight: reportContent.scrollHeight,
        },
        dailyResults: {
          ...bounds(dailyResults),
          display: getComputedStyle(dailyResults).display,
          columns: columnCount(dailyResults),
        },
        ledger: {
          ...bounds(ledger),
          display: getComputedStyle(ledger).display,
          visibility: getComputedStyle(ledger).visibility,
          rowHeights: [...ledger.querySelectorAll<HTMLElement>("tbody tr")].map(
            (row) => row.getBoundingClientRect().height,
          ),
        },
        weekly: {
          ...bounds(weekly),
          display: getComputedStyle(weekly).display,
        },
        weeklyResults: {
          ...bounds(weeklyResults),
          columns: columnCount(weeklyResults),
        },
        action: bounds(action),
        htmlOverflow: getComputedStyle(document.documentElement).overflow,
        bodyOverflow: getComputedStyle(document.body).overflow,
      };
    });

    expect(layout.viewport, viewport.name).toEqual({
      width: viewport.width,
      height: viewport.height,
    });
    expect(layout.document.width, viewport.name).toBeLessThanOrEqual(
      layout.document.clientWidth + 1,
    );
    expect(layout.document.height, viewport.name).toBeLessThanOrEqual(
      layout.document.clientHeight + 1,
    );
    expect(layout.report.scrollHeight, viewport.name).toBeLessThanOrEqual(
      layout.report.clientHeight + 1,
    );
    expect(layout.reportContent.scrollHeight, viewport.name).toBeLessThanOrEqual(
      layout.reportContent.clientHeight + 1,
    );
    expect(layout.htmlOverflow, viewport.name).toBe("hidden");
    expect(layout.bodyOverflow, viewport.name).toBe("hidden");

    for (const rect of [
      layout.shell,
      layout.report,
      layout.reportContent,
      layout.dailyResults,
      layout.ledger,
      layout.weekly,
      layout.weeklyResults,
      layout.action,
    ]) {
      expect(rect.left, viewport.name).toBeGreaterThanOrEqual(-1);
      expect(rect.top, viewport.name).toBeGreaterThanOrEqual(-1);
      expect(rect.right, viewport.name).toBeLessThanOrEqual(viewport.width + 1);
      expect(rect.bottom, viewport.name).toBeLessThanOrEqual(viewport.height + 1);
    }

    expect(layout.dailyResults.display, viewport.name).toBe("grid");
    expect(layout.dailyResults.columns, viewport.name).toBe(viewport.dailyColumns);
    expect(layout.ledger.display, viewport.name).not.toBe("none");
    expect(layout.ledger.visibility, viewport.name).toBe("visible");
    expect(Math.max(...layout.ledger.rowHeights), viewport.name).toBeLessThanOrEqual(48);
    expect(layout.weekly.display, viewport.name).not.toBe("none");
    expect(layout.weeklyResults.columns, viewport.name).toBe(viewport.weeklyColumns);
  }
});
