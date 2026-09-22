import { expect, test, type Locator, type Page } from "@playwright/test";

type MobileViewport = Readonly<{ width: number; height: number; name: string }>;

const viewports: readonly MobileViewport[] = Object.freeze([
  { name: "compact portrait", width: 320, height: 568 },
  { name: "standard portrait", width: 360, height: 740 },
  { name: "tall portrait", width: 390, height: 844 },
  { name: "large portrait", width: 430, height: 932 },
  { name: "compact landscape", width: 568, height: 320 },
  { name: "landscape", width: 740, height: 360 },
  { name: "wide phone landscape", width: 844, height: 390 },
  { name: "large phone landscape", width: 932, height: 430 },
]);

const expectViewportContract = async (
  page: Page,
  expectedView: "planning" | "simulation" | "report" | "forecast",
): Promise<void> => {
  const contract = await page.evaluate(() => {
    const shell = document.querySelector(".game-shell");
    if (!(shell instanceof HTMLElement)) throw new TypeError("Expected .game-shell.");

    const rect = shell.getBoundingClientRect();
    const isVisuallyHidden = (element: HTMLElement): boolean => {
      const style = getComputedStyle(element);
      return (
        (style.clipPath !== "none" && style.clipPath !== "") ||
        (style.position === "absolute" &&
          style.overflow === "hidden" &&
          element.clientWidth <= 1 &&
          element.clientHeight <= 1)
      );
    };

    const isRendered = (element: HTMLElement): boolean => {
      const style = getComputedStyle(element);
      return (
        element !== shell &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        element.getClientRects().length > 0 &&
        !isVisuallyHidden(element)
      );
    };

    const describe = (element: HTMLElement): string => {
      const id = element.id.length > 0 ? `#${element.id}` : "";
      const classes =
        element.classList.length > 0 ? `.${[...element.classList].join(".")}` : "";
      return `${element.tagName.toLowerCase()}${id}${classes}`;
    };

    const rendered = [...document.querySelectorAll<HTMLElement>("body *")].filter(isRendered);

    const overflowViolations = rendered
      .filter((element) => {
        const style = getComputedStyle(element);
        const verticalOverflow = element.scrollHeight > element.clientHeight + 1;
        const horizontalOverflow = element.scrollWidth > element.clientWidth + 1;
        const userScrollable =
          (verticalOverflow && /^(?:auto|scroll)$/u.test(style.overflowY)) ||
          (horizontalOverflow && /^(?:auto|scroll)$/u.test(style.overflowX));
        const verticallyClipped =
          verticalOverflow && /^(?:hidden|clip)$/u.test(style.overflowY);

        return userScrollable || verticallyClipped;
      })
      .map((element) => {
        const style = getComputedStyle(element);
        return {
          element: describe(element),
          client: { width: element.clientWidth, height: element.clientHeight },
          scroll: { width: element.scrollWidth, height: element.scrollHeight },
          overflow: { x: style.overflowX, y: style.overflowY },
        };
      });

    const viewportViolations = rendered
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.left < -1 ||
          rect.top < -1 ||
          rect.right > window.innerWidth + 1 ||
          rect.bottom > window.innerHeight + 1
        );
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          element: describe(element),
          rect: {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
          },
        };
      });

    const interactiveViolations = [
      ...document.querySelectorAll<HTMLElement>(".flow-action-button, .game-slider"),
    ]
      .filter(isRendered)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width < 44 || rect.height < 44;
      })
      .map(describe);

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
      overflowViolations,
      viewportViolations,
      interactiveViolations,
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
  expect(contract.overflowViolations).toEqual([]);
  expect(contract.viewportViolations).toEqual([]);
  expect(contract.interactiveViolations).toEqual([]);
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
  test.describe(`mobile contract: ${viewport.name}`, () => {
    test.use({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      hasTouch: true,
      isMobile: true,
    });

    test("owns the complete daily flow", async ({ page }) => {
      test.slow();
      await page.goto("./");

    const main = page.getByRole("main");
    await expect(main).toBeVisible();
    await expect(main).toHaveAttribute("data-view", "forecast");
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
  });
}
