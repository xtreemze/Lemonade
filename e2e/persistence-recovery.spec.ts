import { expect, type Page, test } from "@playwright/test";

const putStoredRun = async (
  page: Page,
  key: "current" | "recovery",
  value: string,
): Promise<void> => {
  await page.evaluate(
    async ({ storageKey, storageValue }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("lemonade", 1);
        request.addEventListener("success", () => resolve(request.result), { once: true });
        request.addEventListener(
          "error",
          () => reject(request.error ?? new Error("Unable to open test IndexedDB.")),
          { once: true },
        );
      });

      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = database.transaction("runs", "readwrite");
          transaction.objectStore("runs").put(storageValue, storageKey);
          transaction.addEventListener("complete", () => resolve(), { once: true });
          transaction.addEventListener(
            "abort",
            () => reject(transaction.error ?? new Error("Test IndexedDB transaction aborted.")),
            { once: true },
          );
          transaction.addEventListener(
            "error",
            () => reject(transaction.error ?? new Error("Test IndexedDB transaction failed.")),
            { once: true },
          );
        });
      } finally {
        database.close();
      }
    },
    { storageKey: key, storageValue: value },
  );
};

const readStoredRun = async (page: Page, key: "current" | "recovery"): Promise<string | null> =>
  page.evaluate(async (storageKey) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("lemonade", 1);
      request.addEventListener("success", () => resolve(request.result), { once: true });
      request.addEventListener(
        "error",
        () => reject(request.error ?? new Error("Unable to open test IndexedDB.")),
        { once: true },
      );
    });

    try {
      return await new Promise<string | null>((resolve, reject) => {
        const transaction = database.transaction("runs", "readonly");
        const request = transaction.objectStore("runs").get(storageKey);
        request.addEventListener(
          "success",
          () => resolve(typeof request.result === "string" ? request.result : null),
          { once: true },
        );
        request.addEventListener(
          "error",
          () => reject(request.error ?? new Error("Unable to read test run slot.")),
          { once: true },
        );
      });
    } finally {
      database.close();
    }
  }, key);

test.use({ reducedMotion: "reduce" });


test("schema 2 deciding storage migrates to an explicit v4 neutral-memory boundary", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.getByRole("main")).toHaveAttribute("data-view", "planning");

  const current = await readStoredRun(page, "current");
  if (current === null) {
    throw new Error("Expected current persistence slot.");
  }

  const modern = JSON.parse(current) as {
    saveSchemaVersion: number;
    simulationSchemaVersion: number;
    run: {
      seed: number;
      rulesetVersion?: number;
      marketMemory?: unknown;
      state: unknown;
      environment: unknown;
      draft: unknown;
      phase: unknown;
    };
  };
  const versionTwo = {
    saveSchemaVersion: 2,
    simulationSchemaVersion: modern.simulationSchemaVersion,
    run: {
      seed: modern.run.seed,
      state: modern.run.state,
      environment: modern.run.environment,
      draft: modern.run.draft,
      phase: modern.run.phase,
    },
  };

  await putStoredRun(page, "current", JSON.stringify(versionTwo));
  await page.reload();

  await expect(page.getByRole("main")).toHaveAttribute("data-view", "planning");
  await expect(page.locator("#run-status")).toHaveText("Run saved locally.");

  const migratedText = await readStoredRun(page, "current");
  if (migratedText === null) {
    throw new Error("Expected migrated current persistence slot.");
  }
  const migrated = JSON.parse(migratedText) as {
    saveSchemaVersion: number;
    run: {
      rulesetVersion: number;
      marketMemory: {
        expectedPrice: number;
        advertisingFatigue: number;
        stockoutPressure: number;
        excessPressure: number;
        satisfaction: number;
      };
    };
  };

  expect(migrated.saveSchemaVersion).toBe(3);
  expect(migrated.run.rulesetVersion).toBe(4);
  expect(migrated.run.marketMemory).toEqual({
    expectedPrice: 0,
    advertisingFatigue: 0,
    stockoutPressure: 0,
    excessPressure: 0,
    satisfaction: 5000,
  });
});

test("corrupt current storage recovers the last known good snapshot and repairs current", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.getByRole("main")).toHaveAttribute("data-view", "planning");

  await page.getByRole("button", { name: "Sell for the day" }).click();
  await expect(page.getByRole("main")).toHaveAttribute("data-view", "report");
  await expect(page.locator("#run-status")).toHaveText("Day report saved locally.");

  const recoveryBeforeCorruption = await readStoredRun(page, "recovery");
  expect(recoveryBeforeCorruption).not.toBeNull();

  await putStoredRun(page, "current", "{corrupt-current");
  await page.reload();

  await expect(page.getByRole("main")).toHaveAttribute("data-view", "planning");
  await expect(page.getByRole("slider", { name: /Glasses/u })).toHaveValue("5");
  await expect(page.locator("#run-status")).toHaveText(
    "Recovered the last known good run after the current local save failed validation.",
  );

  const repairedCurrent = await readStoredRun(page, "current");
  expect(repairedCurrent).toBe(recoveryBeforeCorruption);
});

test("an unsupported current schema is never replaced by an older recovery snapshot", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.getByRole("main")).toHaveAttribute("data-view", "planning");

  await page.getByRole("button", { name: "Sell for the day" }).click();
  await expect(page.getByRole("main")).toHaveAttribute("data-view", "report");
  await expect(page.locator("#run-status")).toHaveText("Day report saved locally.");

  const current = await readStoredRun(page, "current");
  const recovery = await readStoredRun(page, "recovery");
  if (current === null || recovery === null) {
    throw new Error("Expected both persistence slots.");
  }

  const future = JSON.parse(current) as { saveSchemaVersion: number };
  future.saveSchemaVersion += 1;
  const futureText = JSON.stringify(future);
  await putStoredRun(page, "current", futureText);

  await page.reload();

  await expect(page.getByRole("heading", { name: "Run could not be restored" })).toBeVisible();
  await expect(page.locator("#recovery-error")).toContainText("newer than supported");
  expect(await readStoredRun(page, "current")).toBe(futureText);
  expect(await readStoredRun(page, "recovery")).toBe(recovery);
});

test("reset clears the recovery slot before the fresh run is persisted", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("main")).toHaveAttribute("data-view", "planning");

  await page.getByRole("button", { name: "Sell for the day" }).click();
  await expect(page.getByRole("main")).toHaveAttribute("data-view", "report");
  await expect(page.locator("#run-status")).toHaveText("Day report saved locally.");
  expect(await readStoredRun(page, "recovery")).not.toBeNull();

  await page.reload();
  await expect(page.getByRole("main")).toHaveAttribute("data-view", "report");
  await page.getByRole("button", { name: "Review sales history" }).click();
  await expect(page.getByRole("main")).toHaveAttribute("data-view", "history");
  await page.getByRole("button", { name: "Plan next day" }).click();
  await expect(page.getByRole("main")).toHaveAttribute("data-view", "planning");

  await page.locator(".run-tools-summary").click();
  await page.getByRole("button", { name: "Reset run" }).click();
  await page
    .getByRole("dialog", { name: "Reset this run?" })
    .getByRole("button", {
      name: "Reset run",
    })
    .click();

  await expect(page.getByRole("main")).toHaveAttribute("data-view", "planning");
  await expect(page.locator("#run-status")).toHaveText("Run saved locally.");
  expect(await readStoredRun(page, "recovery")).toBeNull();
});
