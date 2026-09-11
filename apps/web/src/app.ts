import { createProceduralAudioEngine, weatherCue } from "@lemonade/audio";
import {
  availableOperatingFunds,
  createInitialState,
  createSeededRandom,
  financeRulesForTier,
  generateEnvironment,
  glassCount,
  moneyCents,
  predictableFixedObligations,
  seed,
  signCount,
  simulateDay,
  type DayEnvironment,
  type GameState,
  type RandomSource,
  type Seed,
} from "@lemonade/simulation";
import { renderLedgerHistory } from "@lemonade/ui";

import {
  RunPersistenceError,
  clearCurrentRun,
  exportRunSnapshot,
  importRunSnapshot,
  restoreEnvironmentRandom,
  saveCurrentRun,
  type RunPhase,
  type RunSnapshot,
} from "./persistence.js";
import { createLemonsvilleSceneView, type LemonsvilleSceneView } from "./scene.js";

const DEFAULT_RUN_SEED = seed(0x1e_ad_2026);

const weatherLabel: Record<DayEnvironment["weather"]["kind"], string> = {
  sunny: "Sunny",
  cloudy: "Cloudy",
  "hot-and-dry": "Hot & dry",
  thunderstorm: "Thunderstorm",
};

const sentimentLabel: Record<DayEnvironment["sentiment"]["kind"], string> = {
  "very-cold": "Very cautious",
  cold: "Cautious",
  neutral: "Neutral",
  warm: "Interested",
  hot: "Eager",
};

const eventLabel: Record<DayEnvironment["event"]["kind"], string> = {
  none: "No unusual event",
  "street-work": "Street work slowed neighborhood traffic",
  "workers-buy-out": "Road workers bought out the stand",
};

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const formatMoney = (cents: number): string => moneyFormatter.format(cents / 100);

const decisionBudget = (state: GameState): number =>
  Math.max(
    0,
    Number(availableOperatingFunds(state)) - Number(predictableFixedObligations(state)),
  );

const decisionLimit = (state: GameState): Readonly<{ glasses: number; signs: number }> => {
  const budget = decisionBudget(state);
  return Object.freeze({
    glasses: Math.min(250, Math.floor(budget / Number(state.unitCost))),
    signs: Math.min(25, Math.floor(budget / Number(state.signCost))),
  });
};

const financeSummary = (state: GameState): string => {
  const rules = financeRulesForTier(state.tier);
  const parts: string[] = [];

  if (Number(rules.supplierFee) > 0) {
    parts.push(`${formatMoney(Number(rules.supplierFee))} supplier fee`);
  }
  if (Number(rules.taxRate) > 0) {
    parts.push(`${(Number(rules.taxRate) / 100).toFixed(1)}% positive-profit tax`);
  }
  if (Number(rules.bankFee) > 0) {
    parts.push(`${formatMoney(Number(rules.bankFee))} bank fee`);
  }
  if (Number(rules.creditLimit) > 0) {
    parts.push(`${formatMoney(Number(rules.creditLimit))} working-capital limit`);
    parts.push(`${(Number(rules.loanInterestRate) / 100).toFixed(2)}% daily loan interest`);
    parts.push(`${(Number(rules.savingsInterestRate) / 100).toFixed(2)}% daily cash interest`);
  }

  return parts.length === 0
    ? "Classic neighborhood rules — no added finance obligations."
    : parts.join(" · ");
};

const persistenceMessage = (error: unknown): string =>
  error instanceof RunPersistenceError
    ? error.message
    : "Run storage failed unexpectedly. Export your run before leaving this page.";

export const createFreshRunSnapshot = (): RunSnapshot => {
  const state = createInitialState();
  const random = createSeededRandom(DEFAULT_RUN_SEED);
  const environment = generateEnvironment(state.day, random);
  return Object.freeze({
    seed: DEFAULT_RUN_SEED,
    state,
    environment,
    draft: Object.freeze({
      glasses: glassCount(20),
      signs: signCount(1),
      price: moneyCents(10),
    }),
    phase: Object.freeze({ kind: "deciding" }),
  });
};

const SHELL_MARKUP = `
  <main class="game-shell">
    <header class="topline">
      <div>
        <p class="eyebrow">Lemonsville neighborhood market</p>
        <h1>Lemonade</h1>
      </div>
      <dl class="cash-readout" aria-label="Business status">
        <div><dt>Day</dt><dd id="status-day"></dd></div>
        <div><dt>Cash</dt><dd id="status-cash"></dd></div>
        <div id="status-debt-group" hidden><dt>Debt</dt><dd id="status-debt"></dd></div>
      </dl>
    </header>

    <section class="run-tools" aria-label="Run data">
      <div class="run-tools-copy">
        <p class="eyebrow">Run data</p>
        <p id="run-status" class="run-status" role="status" aria-live="polite"></p>
        <p id="run-error" class="inline-error" role="alert" hidden></p>
      </div>
      <div class="run-actions">
        <button id="export-run" class="utility-button" type="button">Export run</button>
        <button id="import-run" class="utility-button" type="button">Import run</button>
        <input id="import-file" type="file" accept="application/json,.json" hidden />
        <button id="reset-run" class="utility-button utility-button-danger" type="button">Reset run</button>
      </div>
    </section>

    <section class="conditions" aria-labelledby="conditions-title">
      <div>
        <p class="eyebrow" id="conditions-title">Today’s conditions</p>
        <strong id="condition-weather"></strong>
      </div>
      <div><span>Market sentiment</span><strong id="condition-sentiment"></strong></div>
      <div><span>Production</span><strong id="condition-production"></strong></div>
      <div><span>Advertising</span><strong id="condition-advertising"></strong></div>
    </section>

    <aside class="obligation-strip" aria-label="Business finance rules">
      <strong id="finance-tier"></strong>
      <span id="finance-summary"></span>
    </aside>

    <section class="stand-stage" aria-label="Lemonsville lemonade stand">
      <canvas id="scene-canvas" class="scene-canvas" role="img"></canvas>
      <div id="scene-fallback" class="scene-fallback" role="img" hidden>
        <strong>Lemonsville</strong>
        <span id="scene-fallback-description"></span>
      </div>
      <p id="scene-equivalent" class="scene-equivalent"></p>
    </section>

    <form id="decision-panel" class="decision-panel">
      <header class="panel-heading">
        <div>
          <p class="eyebrow">Set today’s plan</p>
          <h2>Three decisions. Then sell.</h2>
        </div>
        <p id="decision-spend" class="spend"></p>
      </header>

      <label class="decision-control" for="glasses">
        <span><strong>Glasses</strong><small>Inventory prepared before demand is known</small></span>
        <output id="glasses-output" for="glasses"></output>
        <input id="glasses" name="glasses" type="range" min="0" step="1" />
      </label>

      <label class="decision-control" for="signs">
        <span><strong>Signs</strong><small>Advertising helps demand with diminishing returns</small></span>
        <output id="signs-output" for="signs"></output>
        <input id="signs" name="signs" type="range" min="0" step="1" />
      </label>

      <label class="decision-control" for="price">
        <span><strong>Price</strong><small>Higher margin can sharply reduce demand</small></span>
        <output id="price-output" for="price"></output>
        <input id="price" name="price" type="range" min="1" max="100" step="1" />
      </label>

      <p id="decision-error" class="inline-error" role="alert" hidden>
        This plan exceeds available cash and credit. Reduce glasses or signs.
      </p>
      <button id="sell-button" class="sell-button" type="submit">Sell for the day</button>
    </form>

    <section id="report-panel" class="report-panel" aria-live="polite" aria-labelledby="report-title" hidden>
      <header class="panel-heading">
        <div>
          <p id="report-eyebrow" class="eyebrow"></p>
          <h2 id="report-title"></h2>
        </div>
        <strong id="report-net"></strong>
      </header>

      <dl class="results-grid">
        <div><dt>Sales</dt><dd id="report-sales"></dd></div>
        <div><dt>Expenses</dt><dd id="report-expenses"></dd></div>
        <div><dt>Ending cash</dt><dd id="report-cash"></dd></div>
        <div><dt>Ending debt</dt><dd id="report-debt"></dd></div>
      </dl>

      <div class="ledger-breakdown">
        <h3>Day ledger</h3>
        <table>
          <caption>Credits, operating expenses and financing movements for this day</caption>
          <tbody id="report-ledger-lines"></tbody>
        </table>
      </div>

      <p id="report-event" class="event-note"></p>
      <p id="report-progression" class="progression-note" hidden></p>
      <button id="next-button" class="next-button" type="button">Plan next day</button>
    </section>

    <div id="ledger-history-host"></div>
  </main>
`;

type ElementConstructor<T extends Element> = abstract new () => T;

const requireElement = <T extends Element>(
  root: ParentNode,
  selector: string,
  constructor: ElementConstructor<T>,
): T => {
  const element = root.querySelector(selector);
  if (!(element instanceof constructor)) {
    throw new TypeError(`Expected ${selector} to match ${constructor.name}.`);
  }
  return element;
};

type AppElements = Readonly<{
  statusDay: HTMLElement;
  statusCash: HTMLElement;
  statusDebtGroup: HTMLElement;
  statusDebt: HTMLElement;
  runStatus: HTMLElement;
  runError: HTMLElement;
  exportRun: HTMLButtonElement;
  importRun: HTMLButtonElement;
  importFile: HTMLInputElement;
  resetRun: HTMLButtonElement;
  conditionWeather: HTMLElement;
  conditionSentiment: HTMLElement;
  conditionProduction: HTMLElement;
  conditionAdvertising: HTMLElement;
  financeTier: HTMLElement;
  financeSummary: HTMLElement;
  decisionPanel: HTMLFormElement;
  decisionSpend: HTMLElement;
  glasses: HTMLInputElement;
  glassesOutput: HTMLOutputElement;
  signs: HTMLInputElement;
  signsOutput: HTMLOutputElement;
  price: HTMLInputElement;
  priceOutput: HTMLOutputElement;
  decisionError: HTMLElement;
  sellButton: HTMLButtonElement;
  reportPanel: HTMLElement;
  reportEyebrow: HTMLElement;
  reportTitle: HTMLElement;
  reportNet: HTMLElement;
  reportSales: HTMLElement;
  reportExpenses: HTMLElement;
  reportCash: HTMLElement;
  reportDebt: HTMLElement;
  reportLedgerLines: HTMLTableSectionElement;
  reportEvent: HTMLElement;
  reportProgression: HTMLElement;
  nextButton: HTMLButtonElement;
  historyHost: HTMLElement;
  sceneCanvas: HTMLCanvasElement;
  sceneFallback: HTMLElement;
  sceneFallbackDescription: HTMLElement;
  sceneEquivalent: HTMLElement;
}>;

const collectElements = (root: HTMLElement): AppElements =>
  Object.freeze({
    statusDay: requireElement(root, "#status-day", HTMLElement),
    statusCash: requireElement(root, "#status-cash", HTMLElement),
    statusDebtGroup: requireElement(root, "#status-debt-group", HTMLElement),
    statusDebt: requireElement(root, "#status-debt", HTMLElement),
    runStatus: requireElement(root, "#run-status", HTMLElement),
    runError: requireElement(root, "#run-error", HTMLElement),
    exportRun: requireElement(root, "#export-run", HTMLButtonElement),
    importRun: requireElement(root, "#import-run", HTMLButtonElement),
    importFile: requireElement(root, "#import-file", HTMLInputElement),
    resetRun: requireElement(root, "#reset-run", HTMLButtonElement),
    conditionWeather: requireElement(root, "#condition-weather", HTMLElement),
    conditionSentiment: requireElement(root, "#condition-sentiment", HTMLElement),
    conditionProduction: requireElement(root, "#condition-production", HTMLElement),
    conditionAdvertising: requireElement(root, "#condition-advertising", HTMLElement),
    financeTier: requireElement(root, "#finance-tier", HTMLElement),
    financeSummary: requireElement(root, "#finance-summary", HTMLElement),
    decisionPanel: requireElement(root, "#decision-panel", HTMLFormElement),
    decisionSpend: requireElement(root, "#decision-spend", HTMLElement),
    glasses: requireElement(root, "#glasses", HTMLInputElement),
    glassesOutput: requireElement(root, "#glasses-output", HTMLOutputElement),
    signs: requireElement(root, "#signs", HTMLInputElement),
    signsOutput: requireElement(root, "#signs-output", HTMLOutputElement),
    price: requireElement(root, "#price", HTMLInputElement),
    priceOutput: requireElement(root, "#price-output", HTMLOutputElement),
    decisionError: requireElement(root, "#decision-error", HTMLElement),
    sellButton: requireElement(root, "#sell-button", HTMLButtonElement),
    reportPanel: requireElement(root, "#report-panel", HTMLElement),
    reportEyebrow: requireElement(root, "#report-eyebrow", HTMLElement),
    reportTitle: requireElement(root, "#report-title", HTMLElement),
    reportNet: requireElement(root, "#report-net", HTMLElement),
    reportSales: requireElement(root, "#report-sales", HTMLElement),
    reportExpenses: requireElement(root, "#report-expenses", HTMLElement),
    reportCash: requireElement(root, "#report-cash", HTMLElement),
    reportDebt: requireElement(root, "#report-debt", HTMLElement),
    reportLedgerLines: requireElement(root, "#report-ledger-lines", HTMLTableSectionElement),
    reportEvent: requireElement(root, "#report-event", HTMLElement),
    reportProgression: requireElement(root, "#report-progression", HTMLElement),
    nextButton: requireElement(root, "#next-button", HTMLButtonElement),
    historyHost: requireElement(root, "#ledger-history-host", HTMLElement),
    sceneCanvas: requireElement(root, "#scene-canvas", HTMLCanvasElement),
    sceneFallback: requireElement(root, "#scene-fallback", HTMLElement),
    sceneFallbackDescription: requireElement(root, "#scene-fallback-description", HTMLElement),
    sceneEquivalent: requireElement(root, "#scene-equivalent", HTMLElement),
  });

const numericInputValue = (input: HTMLInputElement, fallback: number): number =>
  Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : fallback;

export type LemonadeAppOptions = Readonly<{
  persistenceEnabled: boolean;
  initialPersistenceError: string | null;
}>;

const DEFAULT_OPTIONS: LemonadeAppOptions = Object.freeze({
  persistenceEnabled: true,
  initialPersistenceError: null,
});

export class LemonadeApp {
  readonly #elements: AppElements;
  readonly #runSeed: Seed;
  readonly #random: RandomSource;
  readonly #audio = createProceduralAudioEngine();
  readonly #scene: LemonsvilleSceneView;
  readonly #persistenceEnabled: boolean;

  #game: GameState;
  #environment: DayEnvironment;
  #phase: RunPhase;
  #glasses: number;
  #signs: number;
  #price: number;
  #saveChain: Promise<void> = Promise.resolve();
  #disposed = false;

  constructor(
    root: HTMLElement,
    initialRun: RunSnapshot = createFreshRunSnapshot(),
    options: LemonadeAppOptions = DEFAULT_OPTIONS,
  ) {
    this.#runSeed = initialRun.seed;
    this.#random = restoreEnvironmentRandom(initialRun);
    this.#game = initialRun.state;
    this.#environment = initialRun.environment;
    this.#phase = initialRun.phase;
    this.#glasses = Number(initialRun.draft.glasses);
    this.#signs = Number(initialRun.draft.signs);
    this.#price = Number(initialRun.draft.price);
    this.#persistenceEnabled = options.persistenceEnabled;

    root.innerHTML = SHELL_MARKUP;
    this.#elements = collectElements(root);
    this.#scene = createLemonsvilleSceneView({
      canvas: this.#elements.sceneCanvas,
      fallback: this.#elements.sceneFallback,
      fallbackDescription: this.#elements.sceneFallbackDescription,
      equivalent: this.#elements.sceneEquivalent,
    });

    this.#elements.decisionPanel.addEventListener("submit", this.#onSell);
    this.#elements.nextButton.addEventListener("click", this.#onNextDay);
    this.#elements.glasses.addEventListener("input", this.#onGlassesInput);
    this.#elements.signs.addEventListener("input", this.#onSignsInput);
    this.#elements.price.addEventListener("input", this.#onPriceInput);
    this.#elements.exportRun.addEventListener("click", this.#onExportRun);
    this.#elements.importRun.addEventListener("click", this.#onImportRun);
    this.#elements.importFile.addEventListener("change", this.#onImportFileChange);
    this.#elements.resetRun.addEventListener("click", this.#onResetRun);
    document.addEventListener("visibilitychange", this.#onVisibilityChange);
    window.addEventListener("pagehide", this.#onPageHide, { once: true });

    this.#elements.importRun.disabled = !this.#persistenceEnabled;
    this.#elements.resetRun.disabled = !this.#persistenceEnabled;
    this.#render();

    if (options.initialPersistenceError !== null) {
      this.#showPersistenceError(options.initialPersistenceError);
    } else if (this.#persistenceEnabled) {
      this.#queueSave("Run saved locally.");
    } else {
      this.#elements.runStatus.textContent = "Autosave is unavailable in this browser context.";
    }
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#elements.decisionPanel.removeEventListener("submit", this.#onSell);
    this.#elements.nextButton.removeEventListener("click", this.#onNextDay);
    this.#elements.glasses.removeEventListener("input", this.#onGlassesInput);
    this.#elements.signs.removeEventListener("input", this.#onSignsInput);
    this.#elements.price.removeEventListener("input", this.#onPriceInput);
    this.#elements.exportRun.removeEventListener("click", this.#onExportRun);
    this.#elements.importRun.removeEventListener("click", this.#onImportRun);
    this.#elements.importFile.removeEventListener("change", this.#onImportFileChange);
    this.#elements.resetRun.removeEventListener("click", this.#onResetRun);
    document.removeEventListener("visibilitychange", this.#onVisibilityChange);
    window.removeEventListener("pagehide", this.#onPageHide);
    this.#scene.dispose();
    void this.#audio.dispose();
  }

  readonly #onVisibilityChange = (): void => {
    if (document.visibilityState === "hidden") {
      void this.#audio.suspend();
    } else {
      void this.#audio.resume();
    }
  };

  readonly #onPageHide = (): void => {
    this.dispose();
  };

  readonly #onGlassesInput = (): void => {
    this.#glasses = numericInputValue(this.#elements.glasses, this.#glasses);
    this.#renderDecisionState();
    this.#renderScene();
  };

  readonly #onSignsInput = (): void => {
    this.#signs = numericInputValue(this.#elements.signs, this.#signs);
    this.#renderDecisionState();
    this.#renderScene();
  };

  readonly #onPriceInput = (): void => {
    this.#price = numericInputValue(this.#elements.price, this.#price);
    this.#renderDecisionState();
  };

  readonly #onSell = (event: SubmitEvent): void => {
    event.preventDefault();
    if (this.#phase.kind !== "deciding") return;

    const affordability = this.#affordability();
    if (!affordability.affordable) return;

    const resolution = simulateDay(
      this.#game,
      Object.freeze({
        glasses: glassCount(this.#glasses),
        signs: signCount(this.#signs),
        price: moneyCents(this.#price),
      }),
      this.#environment,
    );
    const previousTier = this.#game.tier;
    this.#phase = Object.freeze({ kind: "report", resolution });
    this.#render();
    this.#queueSave("Day report saved locally.");

    void this.#audio.enable().then((enabled) => {
      if (!enabled) return;
      this.#audio.play("day:submit");
      const resultCue = Number(resolution.entry.net) >= 0 ? "day:profit" : "day:loss";
      window.setTimeout(() => {
        this.#audio.play(resultCue);
      }, 220);
      if (resolution.nextState.tier !== previousTier) {
        window.setTimeout(() => {
          this.#audio.play("progression:unlock");
        }, 520);
      }
    });
  };

  readonly #onNextDay = (): void => {
    if (this.#phase.kind !== "report") return;

    const nextState = this.#phase.resolution.nextState;
    const nextEnvironment = generateEnvironment(nextState.day, this.#random);
    const limits = decisionLimit(nextState);

    this.#game = nextState;
    this.#environment = nextEnvironment;
    this.#glasses = Math.min(this.#glasses, limits.glasses);
    this.#signs = Math.min(this.#signs, limits.signs);
    this.#phase = Object.freeze({ kind: "deciding" });
    this.#render();
    this.#queueSave("Next day saved locally.");

    void this.#audio.enable().then((enabled) => {
      if (enabled) this.#audio.play(weatherCue(nextEnvironment.weather.kind));
    });
  };

  readonly #onExportRun = (): void => {
    try {
      const documentText = exportRunSnapshot(this.#snapshot());
      const blob = new Blob([documentText], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `lemonade-run-day-${String(Number(this.#game.day))}.json`;
      link.click();
      window.setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 0);
      this.#showPersistenceStatus("Portable run exported.");
    } catch (error) {
      this.#showPersistenceError(persistenceMessage(error));
    }
  };

  readonly #onImportRun = (): void => {
    if (!this.#persistenceEnabled) return;
    this.#elements.importFile.click();
  };

  readonly #onImportFileChange = (): void => {
    const file = this.#elements.importFile.files?.item(0);
    this.#elements.importFile.value = "";
    if (file === null || file === undefined) return;
    void this.#importFile(file);
  };

  readonly #onResetRun = (): void => {
    if (!this.#persistenceEnabled) return;
    const confirmed = window.confirm(
      "Reset this run? The local run will be deleted. Export it first if you want a portable copy.",
    );
    if (confirmed) void this.#resetRun();
  };

  async #importFile(file: File): Promise<void> {
    try {
      const imported = importRunSnapshot(await file.text());
      await this.#saveChain;
      await saveCurrentRun(imported);
      window.location.reload();
    } catch (error) {
      this.#showPersistenceError(persistenceMessage(error));
    }
  }

  async #resetRun(): Promise<void> {
    try {
      await this.#saveChain;
      await clearCurrentRun();
      window.location.reload();
    } catch (error) {
      this.#showPersistenceError(persistenceMessage(error));
    }
  }

  #snapshot(): RunSnapshot {
    return Object.freeze({
      seed: this.#runSeed,
      state: this.#game,
      environment: this.#environment,
      draft: Object.freeze({
        glasses: glassCount(this.#glasses),
        signs: signCount(this.#signs),
        price: moneyCents(this.#price),
      }),
      phase: this.#phase,
    });
  }

  #queueSave(successMessage: string): void {
    if (!this.#persistenceEnabled) return;
    const snapshot = this.#snapshot();
    this.#saveChain = this.#saveChain
      .then(async () => {
        await saveCurrentRun(snapshot);
        if (!this.#disposed) this.#showPersistenceStatus(successMessage);
      })
      .catch((error: unknown) => {
        if (!this.#disposed) this.#showPersistenceError(persistenceMessage(error));
      });
  }

  #showPersistenceStatus(message: string): void {
    this.#elements.runStatus.textContent = message;
    this.#elements.runError.hidden = true;
    this.#elements.runError.textContent = "";
  }

  #showPersistenceError(message: string): void {
    this.#elements.runStatus.textContent = "Run storage needs attention.";
    this.#elements.runError.textContent = message;
    this.#elements.runError.hidden = false;
  }

  #affordability(): Readonly<{ affordable: boolean; operatingFunds: number; spend: number }> {
    const fixedObligations = Number(predictableFixedObligations(this.#game));
    const operatingFunds = Number(availableOperatingFunds(this.#game));
    const spend =
      this.#glasses * Number(this.#game.unitCost) +
      this.#signs * Number(this.#game.signCost) +
      fixedObligations;
    return Object.freeze({ affordable: spend <= operatingFunds, operatingFunds, spend });
  }

  #render(): void {
    this.#renderStatus();
    this.#renderDecisionState();
    this.#renderReportState();
    this.#renderScene();

    const entries =
      this.#phase.kind === "report" ? this.#phase.resolution.nextState.ledger : this.#game.ledger;
    renderLedgerHistory(this.#elements.historyHost, entries);
  }

  #renderStatus(): void {
    this.#elements.statusDay.textContent = String(Number(this.#game.day));
    this.#elements.statusCash.textContent = formatMoney(Number(this.#game.cash));
    this.#elements.statusDebt.textContent = formatMoney(Number(this.#game.loanBalance));
    this.#elements.statusDebtGroup.hidden = !(
      this.#game.tier >= 3 || Number(this.#game.loanBalance) > 0
    );

    this.#elements.conditionWeather.textContent = weatherLabel[this.#environment.weather.kind];
    this.#elements.conditionSentiment.textContent = sentimentLabel[this.#environment.sentiment.kind];
    this.#elements.conditionProduction.textContent = `${formatMoney(Number(this.#game.unitCost))} / glass`;
    this.#elements.conditionAdvertising.textContent = `${formatMoney(Number(this.#game.signCost))} / sign`;
    this.#elements.financeTier.textContent = `Business tier ${String(this.#game.tier)}`;
    this.#elements.financeSummary.textContent = financeSummary(this.#game);
  }

  #renderDecisionState(): void {
    const limits = decisionLimit(this.#game);
    const affordability = this.#affordability();

    this.#elements.decisionPanel.hidden = this.#phase.kind !== "deciding";
    this.#elements.glasses.max = String(limits.glasses);
    this.#elements.glasses.value = String(this.#glasses);
    this.#elements.glassesOutput.textContent = String(this.#glasses);
    this.#elements.signs.max = String(limits.signs);
    this.#elements.signs.value = String(this.#signs);
    this.#elements.signsOutput.textContent = String(this.#signs);
    this.#elements.price.value = String(this.#price);
    this.#elements.priceOutput.textContent = formatMoney(this.#price);
    this.#elements.decisionSpend.textContent = `Spend ${formatMoney(affordability.spend)} of ${formatMoney(affordability.operatingFunds)} operating funds`;
    this.#elements.decisionSpend.className = affordability.affordable
      ? "spend"
      : "spend spend-warning";
    this.#elements.decisionError.hidden = affordability.affordable;
    this.#elements.sellButton.disabled = !affordability.affordable;
  }

  #renderReportState(): void {
    const report = this.#phase.kind === "report" ? this.#phase.resolution : null;
    this.#elements.reportPanel.hidden = report === null;
    if (report === null) return;

    const entry = report.entry;
    const net = Number(entry.net);
    this.#elements.reportEyebrow.textContent = `Day ${String(Number(entry.day))} report`;
    this.#elements.reportTitle.textContent = `${String(Number(entry.sold))} of ${String(Number(entry.decision.glasses))} sold`;
    this.#elements.reportNet.className = net >= 0 ? "profit" : "loss";
    this.#elements.reportNet.textContent = `${net >= 0 ? "+" : "−"}${formatMoney(Math.abs(net))}`;
    this.#elements.reportSales.textContent = formatMoney(Number(entry.revenue));
    this.#elements.reportExpenses.textContent = formatMoney(Number(entry.expenses));
    this.#elements.reportCash.textContent = formatMoney(Number(entry.endingCash));
    this.#elements.reportDebt.textContent = formatMoney(Number(entry.endingLoanBalance));
    this.#elements.reportEvent.textContent = eventLabel[entry.environment.event.kind];

    const rows = entry.lines.map((line) => {
      const row = document.createElement("tr");
      const label = document.createElement("th");
      const amount = document.createElement("td");
      label.scope = "row";
      label.textContent = line.label;
      amount.className = line.direction === "credit" ? "ledger-credit" : "ledger-debit";
      amount.textContent = `${line.direction === "credit" ? "+" : "−"}${formatMoney(Number(line.amount))}`;
      row.append(label, amount);
      return row;
    });
    this.#elements.reportLedgerLines.replaceChildren(...rows);

    const progressed = report.nextState.tier !== this.#game.tier;
    this.#elements.reportProgression.hidden = !progressed;
    this.#elements.reportProgression.textContent = progressed
      ? `Tier ${String(report.nextState.tier)} unlocks tomorrow. New finance rules will be shown before you sell.`
      : "";
  }

  #renderScene(): void {
    const phase = this.#phase;
    this.#scene.update({
      environment: this.#environment,
      visibleSigns:
        phase.kind === "report" ? Number(phase.resolution.entry.decision.signs) : this.#signs,
      phase: phase.kind,
      sold: phase.kind === "report" ? Number(phase.resolution.entry.sold) : 0,
      prepared:
        phase.kind === "report" ? Number(phase.resolution.entry.decision.glasses) : this.#glasses,
    });
  }
}
