// biome-ignore lint/correctness/noUnresolvedImports: Biome 2.5 misses Playwright's Page type re-export.
import { expect, test, type Page } from "@playwright/test";

type RendererSnapshot = Readonly<{
  drawCalls: number;
  triangles: number;
  lines: number;
  points: number;
  geometries: number;
  textures: number;
  frame: number;
  sales: number;
  passers: number;
}>;

const readCounter = (text: string, label: string): number => {
  const match = new RegExp(`^${label}: (\\d+)$`, "mu").exec(text);
  if (match?.[1] === undefined) {
    throw new Error(`missing renderer diagnostic: ${label}`);
  }
  return Number(match[1]);
};

const readSnapshot = async (page: Page): Promise<RendererSnapshot> => {
  // biome-ignore lint/security/noSecrets: stable data-attribute selector, not a credential.
  const diagnostics = page.locator('[data-renderer-diagnostics="true"]');
  const text = (await diagnostics.textContent()) ?? "";
  return Object.freeze({
    drawCalls: readCounter(text, "Draw calls"),
    triangles: readCounter(text, "Triangles"),
    lines: readCounter(text, "Lines"),
    points: readCounter(text, "Points"),
    geometries: readCounter(text, "Geometries"),
    textures: readCounter(text, "Textures"),
    frame: readCounter(text, "Renderer frame"),
    sales: readCounter(text, "Storyboard sales"),
    passers: readCounter(text, "Storyboard passers"),
  });
};

test("deterministic maximum-load scene produces renderer certification evidence", async ({
  page,
}, testInfo) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("./");
  await page.evaluate(() => {
    window.localStorage.setItem("LEMONADE_DEV_SCENE_VIEWER", "1");
    window.localStorage.setItem("LEMONADE_DEV_RENDERER_STRESS", "1");
  });
  await page.reload();

  // The fixture's heading is diagnostic text and may be intentionally hidden
  // from the visual scene. The explicit fixture/diagnostics hooks are the
  // stable browser contract and prove that the stress scene has initialized.
  const fixture = page.locator('[data-renderer-stress-fixture="true"]');
  await expect(fixture).toBeAttached();

  // biome-ignore lint/security/noSecrets: stable data-attribute selector, not a credential.
  const diagnostics = page.locator('[data-renderer-diagnostics="true"]');
  await expect(diagnostics).toBeAttached();
  await expect(diagnostics).toContainText("Fixture: stress");
  await expect(diagnostics).toContainText("Storyboard sales: 400");

  await expect
    .poll(async () => (await readSnapshot(page)).drawCalls, {
      timeout: 10_000,
    })
    .toBeGreaterThan(0);
  await expect
    .poll(async () => (await readSnapshot(page)).geometries, {
      timeout: 10_000,
    })
    .toBeGreaterThan(0);

  const snapshot = await readSnapshot(page);
  expect(snapshot.sales).toBe(400);
  expect(snapshot.passers).toBeGreaterThanOrEqual(60);
  expect(snapshot.triangles).toBeGreaterThan(0);
  expect(snapshot.frame).toBeGreaterThan(0);

  await testInfo.attach("renderer-diagnostics.json", {
    body: JSON.stringify(snapshot, null, 2),
    contentType: "application/json",
  });

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
