import { expect, test } from "@playwright/test";

test("diagnoses Lit decision event boundary", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("./");

  const result = await page.evaluate(() => {
    const decision = document.querySelector("lemonade-decision-panel") as HTMLElement & {
      model?: { glasses?: number; affordable?: boolean };
    };
    const report = document.querySelector("lemonade-day-report") as HTMLElement & {
      model?: { report?: unknown };
    };
    const input = decision?.querySelector("#glasses");
    const form = decision?.querySelector("#decision-panel");
    if (!(decision instanceof HTMLElement) || !(report instanceof HTMLElement)) {
      return { error: "missing hosts" };
    }
    if (!(input instanceof HTMLInputElement) || !(form instanceof HTMLFormElement)) {
      return { error: "missing native controls" };
    }

    let decisionChanges = 0;
    let decisionSubmits = 0;
    decision.addEventListener("lemonade-decision-change", () => { decisionChanges += 1; });
    decision.addEventListener("lemonade-decision-submit", () => { decisionSubmits += 1; });

    const initialGlasses = decision.model?.glasses;
    input.value = String(Number(input.value) + 1);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const afterInputGlasses = decision.model?.glasses;

    form.requestSubmit();
    const reportAfterSubmit = report.model?.report ?? null;

    return {
      decisionChanges,
      decisionSubmits,
      initialGlasses,
      afterInputGlasses,
      reportAfterSubmit: reportAfterSubmit === null ? "null" : "present",
    };
  });

  console.log("LIT_BOUNDARY_DIAGNOSTIC", JSON.stringify({ result, pageErrors }));
  expect(result).toMatchObject({
    decisionChanges: 1,
    decisionSubmits: 1,
    reportAfterSubmit: "present",
  });
});
