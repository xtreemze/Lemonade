import { expect, test, type Locator, type Page } from "@playwright/test";

type MobileViewport = Readonly<{ width: number; height: number; name: string }>;

const viewports: readonly MobileViewport[] = Object.freeze([
  { name: "compact portrait", width: 320, height: 568 },
  { name: "standard portrait", width: 360, height: 740 },
  { name: "tall portrait", width: 390, height: 844 },
  { name: "large portrait", width: 430, height: 932 },
  { name: "landscape", width: 740, height: 360 },
  { name: "wide phone landscape", width: 844, height: 390 },
  { name: "large phone landscape", width: 932, height: 430 },
]);

test.use({ hasTouch: true, isMobile: true });

const expectViewportContract = async (
  page: Page,
  expectedView: "planning" | "simulation" | "report" | "forecast",
): Promise<void> => {
  const contract = await page.evaluate(() => {
    const shell = document.querySelector(".game-shell");
    if (!(shell instanceof HTMLElement)) throw new TypeError("Expected .game-shell.");

    const rect = shell.getBoundingClientRect();
    const scrollable = [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((element) => {
        const style = getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") return false;
        const vertical =
          /^(?:auto|scroll)$/u.test(style.overflowY) &&
          element.scrollHeight > element.clientHeight + 1;
        const horizontal =
          /^(?:auto|scroll)$/u.test(style.overflowX) &&
          element.scrollWidth > element.clientWidth + 1;
        return vertical || horizontal;
      })
      .map((element) => {
        const id = element.id.length > 0 ? `#${element.id}` : "";
        const classes =
          element.classList.length > 0 ? `.${[...element.classList].join(".")}` : "";
        return `${element.tagName.toLowerCase()}${id}${classes}`;
      });

    return {
      view: shell.dataset["view"],
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      shell: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
      document: {
        clientWidth: document.documentElement.clientWidth,
        clientHeight: document.documentElement.clientHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
      },
      windowScroll: { x: window.scrollX, y: window.scrollY },
      bodyOverflow: getComputedStyle(document.body).overflow,
      shellOverflow: getComputedStyle(shell).overflow,
      scrollable,
    };
  });

  expect(contract.view).toBe(expectedView);
  expect(Math.abs(contract.shell.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(contract.shell.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(contract.shell.width - contract.viewportWidth)).toBeLessThanOrEqual(1);
  expect(Math.abs(contract.shell.height - contract.viewportHeight)).toBeLessThanOrEqual(1);
  expect(contract.document.scrollWidth).toBeLessThanOrEqual(contract.document.clientWidth + 1);
  expect(contract.document.scrollHeight).toBeLessThanOrEqual(contract.document.clientHeight + 1);
  expect(contract.windowScroll).toEqual({ x: 0, y: 0 });
  expect(contract.bodyOverflow).toBe("hidden");
  expect(contract.shellOverflow).toBe("hidden");
  expect(contract.scrollable).toEqual([]);
};

const expectCenteredBottomAction = async (
  page: Page,
  action: Locator,
  maximumBottomGap = 24,
): Promise<void> => {
  await expect(action).toBeVisible();
  const box = await action.boundingBox();
  if (box === null) throw new Error("Expected primary action bounds.");

  const viewport = page.viewportSize();
  if (viewport === null) throw new Error("Expected an explicit mobile viewport.");

  expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(2);
  expect(viewport.height - (box.y + box.height)).toBeGreaterThanOrEqual(0);
  expect(viewport.height - (box.y + box.height)).toBeLessThanOrEqual(maximumBottomGap);
  expect((await action.textContent())?.trim()).toBe("");
};

test.describe.configure({ mode: "parallel" });

for (const viewport of viewports) {
  test(`mobile contract: ${viewport.name} owns the complete daily flow`, async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("./");

    await expectViewportContract(page, "forecast");
    await expect(page.locator("#scene-canvas")).toHaveAttribute(
      "data-presentation-duration-ms",
      "6000",
    );
    await expect(page.getByRole("main")).toHaveAttribute("data-view", "planning", {
      timeout: 10_000,
    });
    await expectViewportContract(page, "planning");
    await expect(page.getByRole("slider")).toHaveCount(3);
    await expectCenteredBottomAction(
      page,
      page.getByRole("button", { name: "Sell for the day" }),
      viewport.height <= 360 ? 18 : 24,
    );

    await page.getByRole("button", { name: "Sell for the day" }).click();
    await expect(page.getByRole("main")).toHaveAttribute("data-view", "simulation");
    await expectViewportContract(page, "simulation");

    await expect(page.getByRole("main")).toHaveAttribute("data-view", "report", {
      timeout: 15_000,
    });
    await expectViewportContract(page, "report");
    await expect(page.locator("#report-title")).toBeVisible();
    await expect(page.locator(".results-grid > div")).toHaveCount(4);
    await expectCenteredBottomAction(
      page,
      page.getByRole("button", { name: "Plan next day" }),
      viewport.height <= 360 ? 18 : 24,
    );

    await page.getByRole("button", { name: "Plan next day" }).click();
    await expect(page.getByRole("main")).toHaveAttribute("data-view", "forecast");
    await expectViewportContract(page, "forecast");

    await expect(page.getByRole("main")).toHaveAttribute("data-view", "planning", {
      timeout: 10_000,
    });
    await expectViewportContract(page, "planning");
  });
}
