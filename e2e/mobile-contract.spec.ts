import { expect, type Locator, type Page, test } from "@playwright/test";

type MobileViewport = Readonly<{ width: number; height: number; name: string }>;

const viewports: readonly MobileViewport[] = Object.freeze([
  { name: "compact portrait", width: 320, height: 568 },
  { name: "standard portrait", width: 360, height: 740 },
  { name: "tall portrait", width: 390, height: 844 },
  { name: "large portrait", width: 430, height: 932 },
  { name: "tablet portrait", width: 768, height: 1024 },
  { name: "compact landscape", width: 568, height: 320 },
  { name: "landscape", width: 740, height: 360 },
  { name: "wide phone landscape", width: 844, height: 390 },
  { name: "large phone landscape", width: 932, height: 430 },
  { name: "tablet landscape", width: 1024, height: 768 },
]);

const desktopViewports: readonly MobileViewport[] = Object.freeze([
  { name: "compact desktop", width: 800, height: 600 },
  { name: "standard desktop", width: 1024, height: 768 },
  { name: "wide desktop", width: 1280, height: 720 },
  { name: "large desktop", width: 1600, height: 900 },
]);

const expectViewportContract = async (
  page: Page,
  expectedView: "planning" | "simulation" | "report" | "history" | "forecast",
): Promise<void> => {
  const contract = await page.evaluate(() => {
    const shell = document.querySelector(".game-shell");
    if (!(shell instanceof HTMLElement)) {
      throw new TypeError("Expected .game-shell.");
    }

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
      const classes = element.classList.length > 0 ? `.${[...element.classList].join(".")}` : "";
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
        const verticallyClipped = verticalOverflow && /^(?:hidden|clip)$/u.test(style.overflowY);

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
      view: shell.dataset.view,
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
      htmlOverflow: getComputedStyle(document.documentElement).overflow,
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
  expect(contract.htmlOverflow).toBe("hidden");
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
  if (box === null) {
    throw new Error("Expected primary action bounds.");
  }

  const viewport = page.viewportSize();
  if (viewport === null) {
    throw new Error("Expected an explicit mobile viewport.");
  }

  expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(2);
  expect(viewport.height - (box.y + box.height)).toBeGreaterThanOrEqual(0);
  expect(viewport.height - (box.y + box.height)).toBeLessThanOrEqual(maximumBottomGap);
  expect((await action.textContent())?.trim()).toBe("");
};

const expectCompactReportComposition = async (
  page: Page,
  viewport: MobileViewport,
): Promise<void> => {
  const layout = await page.locator(".report-panel").evaluate((panel) => {
    const heading = panel.querySelector<HTMLElement>(".panel-heading");
    const ledger = panel.querySelector<HTMLElement>(".ledger-breakdown");
    const ledgerHeading = ledger?.querySelector<HTMLElement>("h3") ?? null;
    const ledgerTable = ledger?.querySelector<HTMLElement>("table") ?? null;

    if (heading === null || ledger === null || ledgerHeading === null || ledgerTable === null) {
      throw new TypeError("Expected complete report composition.");
    }

    const headingRect = heading.getBoundingClientRect();
    const headingCopy = heading.firstElementChild;
    const net = panel.querySelector<HTMLElement>("#report-net");

    if (!(headingCopy instanceof HTMLElement) || net === null) {
      throw new TypeError("Expected report heading copy and net result.");
    }

    const copyRect = headingCopy.getBoundingClientRect();
    const netRect = net.getBoundingClientRect();

    return {
      headingDirection: getComputedStyle(heading).flexDirection,
      heading: { left: headingRect.left, right: headingRect.right },
      headingCopy: { left: copyRect.left, right: copyRect.right },
      net: { left: netRect.left, right: netRect.right },
      ledgerHeight: ledger.getBoundingClientRect().height,
      ledgerContentHeight:
        ledgerHeading.getBoundingClientRect().height + ledgerTable.getBoundingClientRect().height,
    };
  });

  expect(layout.headingDirection).toBe("row");

  if (viewport.width < 640) {
    expect(layout.headingCopy.left).toBeLessThanOrEqual(layout.heading.left + 1);
    expect(layout.net.right).toBeGreaterThanOrEqual(layout.heading.right - 1);
    expect(layout.headingCopy.right).toBeLessThanOrEqual(layout.net.left);
    expect(layout.ledgerHeight).toBeLessThanOrEqual(layout.ledgerContentHeight + 4);
  }
};

const expectCompactPortraitHistory = async (
  page: Page,
  viewport: MobileViewport,
): Promise<void> => {
  if (viewport.width >= viewport.height || viewport.width >= 761) {
    return;
  }

  const layout = await page.locator("#ledger-history-host").evaluate((host) => {
    const section = host.querySelector<HTMLElement>(".ledger-history");
    const charts = [...host.querySelectorAll<SVGElement>(".history-chart")];

    if (section === null || charts.length === 0) {
      throw new TypeError("Expected rendered sales history.");
    }

    const chartGrid = section.querySelector<HTMLElement>(".chart-grid");
    if (chartGrid === null) {
      throw new TypeError("Expected sales-history chart grid.");
    }

    const columns = getComputedStyle(chartGrid)
      .gridTemplateColumns.trim()
      .split(/\\s+/u)
      .filter(Boolean).length;

    return {
      hostHeight: host.getBoundingClientRect().height,
      sectionHeight: section.getBoundingClientRect().height,
      chartGridColumns: columns,
      chartHeights: charts.map((chart) => chart.getBoundingClientRect().height),
      chartWidths: charts.map((chart) => chart.getBoundingClientRect().width),
    };
  });

  expect(layout.sectionHeight).toBeLessThan(layout.hostHeight - 4);
  expect(Math.max(...layout.chartHeights)).toBeLessThanOrEqual(169);

  if (viewport.width >= 360) {
    expect(layout.chartGridColumns).toBe(2);
    expect(Math.min(...layout.chartWidths)).toBeGreaterThanOrEqual(140);
    expect(Math.max(...layout.chartHeights)).toBeLessThanOrEqual(145);
  } else {
    expect(layout.chartGridColumns).toBe(1);
  }
};

const expectDesktopReportComposition = async (
  page: Page,
  viewport: MobileViewport,
): Promise<void> => {
  const layout = await page.locator(".report-panel").evaluate((panel) => {
    const content = panel.querySelector<HTMLElement>(".report-content");
    const ledger = panel.querySelector<HTMLElement>(".ledger-breakdown");
    const ledgerHeading = ledger?.querySelector<HTMLElement>("h3") ?? null;
    const ledgerTable = ledger?.querySelector<HTMLElement>("table") ?? null;

    if (content === null || ledger === null || ledgerHeading === null || ledgerTable === null) {
      throw new TypeError("Expected complete desktop report composition.");
    }

    const columns = getComputedStyle(content)
      .gridTemplateColumns.trim()
      .split(/\s+/u)
      .filter(Boolean).length;

    return {
      panelWidth: panel.getBoundingClientRect().width,
      columns,
      ledgerHeight: ledger.getBoundingClientRect().height,
      ledgerContentHeight:
        ledgerHeading.getBoundingClientRect().height + ledgerTable.getBoundingClientRect().height,
    };
  });

  expect(layout.columns).toBe(2);
  expect(layout.panelWidth).toBeLessThanOrEqual(Math.min(viewport.width, 1408) + 1);
  expect(layout.ledgerHeight).toBeLessThanOrEqual(layout.ledgerContentHeight + 4);
};

const expectDesktopHistoryComposition = async (
  page: Page,
  viewport: MobileViewport,
): Promise<void> => {
  const layout = await page.locator("#ledger-history-host").evaluate((host) => {
    const section = host.querySelector<HTMLElement>(".ledger-history");
    const chartGrid = host.querySelector<HTMLElement>(".chart-grid");
    const charts = [...host.querySelectorAll<SVGElement>(".history-chart")];

    if (section === null || chartGrid === null || charts.length === 0) {
      throw new TypeError("Expected complete desktop sales-history composition.");
    }

    const columns = getComputedStyle(chartGrid)
      .gridTemplateColumns.trim()
      .split(/\s+/u)
      .filter(Boolean).length;

    return {
      sectionWidth: section.getBoundingClientRect().width,
      columns,
      chartHeights: charts.map((chart) => chart.getBoundingClientRect().height),
    };
  });

  expect(layout.columns).toBe(2);
  expect(layout.sectionWidth).toBeLessThanOrEqual(Math.min(viewport.width, 1408) + 1);

  if (viewport.width >= 1024) {
    expect(Math.max(...layout.chartHeights)).toBeLessThanOrEqual(321);
  }
};

const expectPlanningControlWeight = async (page: Page): Promise<void> => {
  const metrics = await page.locator(".decision-panel").evaluate((panel) => {
    const sliders = [...panel.querySelectorAll<HTMLInputElement>(".game-slider")];
    const controls = [...panel.querySelectorAll<HTMLElement>(".decision-control")];
    const firstSliderStyle = sliders[0] === undefined ? null : getComputedStyle(sliders[0]);
    const controlRects = controls.map((control) => control.getBoundingClientRect());

    return {
      sliderCount: sliders.length,
      trackSize:
        firstSliderStyle === null
          ? 0
          : Number.parseFloat(firstSliderStyle.getPropertyValue("--slider-track-size")),
      sliderHeights: sliders.map((slider) => slider.getBoundingClientRect().height),
      controlGaps: controlRects.slice(1).map((rect, index) => {
        const previous = controlRects[index];
        return previous === undefined ? 0 : rect.top - previous.bottom;
      }),
    };
  });

  const viewport = page.viewportSize();
  if (viewport === null) {
    throw new Error("Expected an explicit mobile viewport.");
  }

  expect(metrics.sliderCount).toBe(3);
  expect(metrics.trackSize).toBeGreaterThanOrEqual(16);
  expect(Math.min(...metrics.sliderHeights)).toBeGreaterThanOrEqual(60);
  expect(Math.min(...metrics.controlGaps)).toBeGreaterThanOrEqual(0);
};

test("simulation action art keeps the repaired transparent animated glass", async ({ request }) => {
  const response = await request.get("./lemonade-simulate.svg");
  expect(response.ok()).toBe(true);

  const svg = await response.text();
  expect(svg).toContain('clipPath id="glass-clip"');
  expect(svg).toContain('clip-path="url(#glass-clip)"');
  expect(svg).toContain('class="ice-float"');
  expect(svg).toContain('class="straw-float"');
  expect(svg).toContain('class="pour-stream"');
  expect(svg).toContain("@keyframes pour");
  expect(svg).toContain("@keyframes bob");
  expect(svg).toContain('id="glassBottom"');
  expect(svg).toContain('id="straw-2"');
  expect(svg).toContain('id="cube5"');
  expect(svg).toContain('id="highlight"');
  expect(svg).not.toMatch(/stroke\s*:\s*#(?:211d14|000000|000)\b/i);
  expect(svg).not.toContain('class="outline"');
  expect(svg).not.toContain('<rect width="128" height="128"');
});

test.describe.configure({ mode: "parallel" });

for (const viewport of viewports) {
  test(`mobile contract: ${viewport.name} owns the complete daily flow`, async ({
    browser,
  }, testInfo) => {
    test.slow();

    const configuredBaseUrl = testInfo.project.use.baseURL;
    if (typeof configuredBaseUrl !== "string") {
      throw new TypeError("Mobile contract requires a configured Playwright baseURL.");
    }

    const context = await browser.newContext({
      baseURL: configuredBaseUrl,
      viewport: { width: viewport.width, height: viewport.height },
      screen: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();

    try {
      await page.goto("./", { waitUntil: "commit" });

      const initialViewport = await page.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
      }));
      expect(initialViewport).toEqual({
        width: viewport.width,
        height: viewport.height,
        screenWidth: viewport.width,
        screenHeight: viewport.height,
      });

      const main = page.getByRole("main");
      await expect(main).toBeVisible();
      await expect(main).toHaveAttribute("data-view", "forecast");
      await expectViewportContract(page, "forecast");
      await expect(page.locator("#scene-canvas")).toHaveAttribute(
        "data-presentation-duration-ms",
        "6000",
      );

      await expect(main).toHaveAttribute("data-view", "planning", { timeout: 10_000 });
      await expectViewportContract(page, "planning");
      await expect(page.getByRole("slider")).toHaveCount(3);
      await expectPlanningControlWeight(page);
      await expectCenteredBottomAction(
        page,
        page.getByRole("button", { name: "Sell for the day" }),
        viewport.height <= 360 ? 18 : 24,
      );

      await page.getByRole("button", { name: "Sell for the day" }).click();
      await expect(main).toHaveAttribute("data-view", "simulation");
      await expectViewportContract(page, "simulation");

      await expect(main).toHaveAttribute("data-view", "report", { timeout: 15_000 });
      await expectViewportContract(page, "report");
      await expect(page.locator("#report-title")).toBeVisible();
      await expect(page.locator(".results-grid > div")).toHaveCount(4);
      await expectCompactReportComposition(page, viewport);
      await expectCenteredBottomAction(
        page,
        page.getByRole("button", { name: "Review sales history" }),
        viewport.height <= 360 ? 18 : 24,
      );

      await page.getByRole("button", { name: "Review sales history" }).click();
      await expect(main).toHaveAttribute("data-view", "history");
      await expectViewportContract(page, "history");
      await expect(page.getByRole("region", { name: "Sales history" })).toBeVisible();
      await expectCompactPortraitHistory(page, viewport);
      await expectCenteredBottomAction(
        page,
        page.getByRole("button", { name: "Plan next day" }),
        viewport.height <= 360 ? 18 : 24,
      );

      await page.getByRole("button", { name: "Plan next day" }).click();
      await expect(main).toHaveAttribute("data-view", "forecast");
      await expectViewportContract(page, "forecast");

      await expect(main).toHaveAttribute("data-view", "planning", { timeout: 10_000 });
      await expectViewportContract(page, "planning");
    } finally {
      await context.close();
    }
  });
}

const bankruptcyViewports: readonly MobileViewport[] = Object.freeze([
  { name: "bankruptcy compact portrait", width: 320, height: 568 },
  { name: "bankruptcy compact landscape", width: 568, height: 320 },
]);

for (const viewport of bankruptcyViewports) {
  test(`mobile contract: ${viewport.name} keeps the terminal run fully visible`, async ({
    browser,
  }, testInfo) => {
    test.slow();

    const configuredBaseUrl = testInfo.project.use.baseURL;
    if (typeof configuredBaseUrl !== "string") {
      throw new TypeError("Mobile contract requires a configured Playwright baseURL.");
    }

    const context = await browser.newContext({
      baseURL: configuredBaseUrl,
      viewport: { width: viewport.width, height: viewport.height },
      screen: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      hasTouch: true,
      isMobile: true,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();

    try {
      await page.goto("./", { waitUntil: "commit" });
      const main = page.getByRole("main");
      await expect(main).toHaveAttribute("data-view", "planning");

      for (const [selector, value] of [
        ["#glasses", 10],
        ["#signs", 0],
        ["#price", 1],
      ] as const) {
        await page.locator(selector).evaluate((element, nextValue) => {
          if (!(element instanceof HTMLInputElement)) {
            throw new TypeError("Expected planning range input.");
          }
          element.value = String(nextValue);
          element.dispatchEvent(new Event("input", { bubbles: true }));
        }, value);
      }
      await page.getByRole("button", { name: "Sell for the day" }).click();

      await expect(main).toHaveAttribute("data-view", "report");
      await expect(page.locator("#report-milestone")).toContainText("Bankrupt");
      await expectViewportContract(page, "report");
      await expectCenteredBottomAction(
        page,
        page.getByRole("button", { name: "Review sales history" }),
        viewport.height <= 360 ? 18 : 24,
      );

      await page.getByRole("button", { name: "Review sales history" }).click();
      await expect(main).toHaveAttribute("data-view", "history");
      await expectViewportContract(page, "history");
      await expectCenteredBottomAction(
        page,
        page.getByRole("button", { name: "Start a new game" }),
        viewport.height <= 360 ? 18 : 24,
      );
    } finally {
      await context.close();
    }
  });
}

for (const viewport of desktopViewports) {
  test(`fullscreen contract: ${viewport.name} never falls back to page scrolling`, async ({
    browser,
  }, testInfo) => {
    test.slow();

    const configuredBaseUrl = testInfo.project.use.baseURL;
    if (typeof configuredBaseUrl !== "string") {
      throw new TypeError("Flow contract requires a configured Playwright baseURL.");
    }

    const context = await browser.newContext({
      baseURL: configuredBaseUrl,
      viewport: { width: viewport.width, height: viewport.height },
      screen: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      hasTouch: false,
      isMobile: false,
    });
    const page = await context.newPage();

    try {
      await page.goto("./", { waitUntil: "commit" });

      const main = page.getByRole("main");
      await expect(main).toBeVisible();
      await expect(main).toHaveAttribute("data-view", "forecast");
      await expectViewportContract(page, "forecast");

      await expect(main).toHaveAttribute("data-view", "planning", { timeout: 10_000 });
      await expectViewportContract(page, "planning");
      await expectPlanningControlWeight(page);
      await expectCenteredBottomAction(
        page,
        page.getByRole("button", { name: "Sell for the day" }),
      );

      await page.getByRole("button", { name: "Sell for the day" }).click();
      await expect(main).toHaveAttribute("data-view", "simulation");
      await expectViewportContract(page, "simulation");

      await expect(main).toHaveAttribute("data-view", "report", { timeout: 15_000 });
      await expectViewportContract(page, "report");
      await expectDesktopReportComposition(page, viewport);
      await expectCenteredBottomAction(
        page,
        page.getByRole("button", { name: "Review sales history" }),
      );

      await page.getByRole("button", { name: "Review sales history" }).click();
      await expect(main).toHaveAttribute("data-view", "history");
      await expectViewportContract(page, "history");
      await expect(page.getByRole("region", { name: "Sales history" })).toBeVisible();
      await expectDesktopHistoryComposition(page, viewport);
      await expectCenteredBottomAction(page, page.getByRole("button", { name: "Plan next day" }));

      await page.getByRole("button", { name: "Plan next day" }).click();
      await expect(main).toHaveAttribute("data-view", "forecast");
      await expectViewportContract(page, "forecast");
    } finally {
      await context.close();
    }
  });
}
