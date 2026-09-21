import { createProceduralAudioEngine, weatherCue, type AudioCue } from "@lemonade/audio";
import {
  availableOperatingFunds,
  createInitialState,
  createSeededRandom,
  financeRulesForTier,
  generateEnvironment,
  glassCount,
  legacyConfidenceForState,
  moneyCents,
  operatingScaleForState,
  predictableFixedObligations,
  seed,
  signCount,
  simulateDay,
  type DayEnvironment,
  type DayResolution,
  type GameState,
  type OperatingScaleLevel,
  type RandomSource,
  type Seed,
} from "@lemonade/simulation";
import { renderLedgerHistory, summarizeCompletedWeek } from "@lemonade/ui";

import {
  DecisionChangeEvent,
  LemonadeDayReport,
  LemonadeDecisionPanel,
  LemonadeRunTools,
  RunImportFileEvent,
} from "./components.js";
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
import { createHapticEngine, type HapticCue } from "./haptics.js";
import { createPurchaseFeedbackSchedule } from "./purchase-feedback.js";
import { createLemonsvilleSceneView, type LemonsvilleSceneView } from "./scene.js";

const DEFAULT_RUN_SEED = seed(0x1e_ad_2026);
const SIMULATION_PRESENTATION_MS = 5_000;
const FORECAST_PRESENTATION_MS = 3_000;

type PresentationPhase = "planning" | "simulation" | "report" | "forecast";

const weatherLabel: Record<DayEnvironment["weather"]["kind"], string> = {
  sunny: "Sunny",
  cloudy: "Cloudy",
  "hot-and-dry": "Partly cloudy",
  thunderstorm: "Thunderstorm",
};

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const formatMoney = (cents: number): string => moneyFormatter.format(cents / 100);

const decisionLimit = (
  state: GameState,
): Readonly<{ glasses: number; signs: number; price: number }> => {
  const scale = operatingScaleForState(state);
  return Object.freeze({
    glasses: scale.maxGlasses,
    signs: scale.maxSigns,
    price: scale.maxPriceCents,
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
      glasses: glassCount(5),
      signs: signCount(1),
      price: moneyCents(150),
    }),
    phase: Object.freeze({ kind: "deciding" }),
  });
};

const SHELL_MARKUP = `
  <main class="game-shell" data-view="planning">
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

    <lemonade-run-tools></lemonade-run-tools>

    <section class="conditions" aria-labelledby="conditions-title">
      <div>
        <p class="eyebrow" id="conditions-title">Today’s conditions</p>
        <strong id="condition-weather"></strong>
      </div>
      <div><span>Confidence</span><strong id="condition-sentiment"></strong></div>
      <div><span>Production</span><strong id="condition-production"></strong></div>
      <div><span>Advertising</span><strong id="condition-advertising"></strong></div>
    </section>

    <aside class="obligation-strip" aria-label="Business finance rules">
      <strong id="finance-tier"></strong>
      <span id="finance-summary"></span>
    </aside>

    <section class="stand-stage" aria-label="Lemonsville lemonade stand">
      <div class="scene-overlay" aria-live="polite">
        <p id="scene-kicker" class="eyebrow"></p>
        <strong id="scene-title"></strong>
      </div>
      <canvas id="scene-canvas" class="scene-canvas" role="img"></canvas>
      <div id="scene-fallback" class="scene-fallback" role="img" hidden>
        <strong>Lemonsville</strong>
        <span id="scene-fallback-description"></span>
      </div>
      <p id="scene-equivalent" class="scene-equivalent"></p>
    </section>

    <lemonade-decision-panel></lemonade-decision-panel>

    <lemonade-day-report></lemonade-day-report>

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
  gameShell: HTMLElement;
  statusDay: HTMLElement;
  statusCash: HTMLElement;
  statusDebtGroup: HTMLElement;
  statusDebt: HTMLElement;
  runTools: LemonadeRunTools;
  conditionWeather: HTMLElement;
  conditionSentiment: HTMLElement;
  conditionProduction: HTMLElement;
  conditionAdvertising: HTMLElement;
  financeTier: HTMLElement;
  financeSummary: HTMLElement;
  decisionPanel: LemonadeDecisionPanel;
  reportPanel: LemonadeDayReport;
  historyHost: HTMLElement;
  sceneKicker: HTMLElement;
  sceneTitle: HTMLElement;
  sceneCanvas: HTMLCanvasElement;
  sceneFallback: HTMLElement;
  sceneFallbackDescription: HTMLElement;
  sceneEquivalent: HTMLElement;
}>;

const collectElements = (root: HTMLElement): AppElements =>
  Object.freeze({
    gameShell: requireElement(root, ".game-shell", HTMLElement),
    statusDay: requireElement(root, "#status-day", HTMLElement),
    statusCash: requireElement(root, "#status-cash", HTMLElement),
    statusDebtGroup: requireElement(root, "#status-debt-group", HTMLElement),
    statusDebt: requireElement(root, "#status-debt", HTMLElement),
    runTools: requireElement(root, "lemonade-run-tools", LemonadeRunTools),
    conditionWeather: requireElement(root, "#condition-weather", HTMLElement),
    conditionSentiment: requireElement(root, "#condition-sentiment", HTMLElement),
    conditionProduction: requireElement(root, "#condition-production", HTMLElement),
    conditionAdvertising: requireElement(root, "#condition-advertising", HTMLElement),
    financeTier: requireElement(root, "#finance-tier", HTMLElement),
    financeSummary: requireElement(root, "#finance-summary", HTMLElement),
    decisionPanel: requireElement(root, "lemonade-decision-panel", LemonadeDecisionPanel),
    reportPanel: requireElement(root, "lemonade-day-report", LemonadeDayReport),
    historyHost: requireElement(root, "#ledger-history-host", HTMLElement),
    sceneKicker: requireElement(root, "#scene-kicker", HTMLElement),
    sceneTitle: requireElement(root, "#scene-title", HTMLElement),
    sceneCanvas: requireElement(root, "#scene-canvas", HTMLCanvasElement),
    sceneFallback: requireElement(root, "#scene-fallback", HTMLElement),
    sceneFallbackDescription: requireElement(root, "#scene-fallback-description", HTMLElement),
    sceneEquivalent: requireElement(root, "#scene-equivalent", HTMLElement),
  });

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
  readonly #haptics = createHapticEngine();
  readonly #scene: LemonsvilleSceneView;
  readonly #persistenceEnabled: boolean;

  #game: GameState;
  #environment: DayEnvironment;
  #phase: RunPhase;
  #presentation: PresentationPhase;
  #presentationTimer: number | null = null;
  #feedbackTimers: number[] = [];
  #glasses: number;
  #signs: number;
  #price: number;
  #runStatusMessage = "";
  #runErrorMessage: string | null = null;
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
    this.#presentation = initialRun.phase.kind === "report" ? "report" : "planning";
    const initialLimits = decisionLimit(this.#game);
    this.#glasses = Math.min(Number(initialRun.draft.glasses), initialLimits.glasses);
    this.#signs = Math.min(Number(initialRun.draft.signs), initialLimits.signs);
    this.#price = Math.min(Number(initialRun.draft.price), initialLimits.price);
    this.#persistenceEnabled = options.persistenceEnabled;

    root.innerHTML = SHELL_MARKUP;
    this.#elements = collectElements(root);
    this.#scene = createLemonsvilleSceneView({
      canvas: this.#elements.sceneCanvas,
      fallback: this.#elements.sceneFallback,
      fallbackDescription: this.#elements.sceneFallbackDescription,
      equivalent: this.#elements.sceneEquivalent,
    });

    this.#elements.decisionPanel.addEventListener(
      "lemonade-decision-change",
      this.#onDecisionChange,
    );
    this.#elements.decisionPanel.addEventListener("lemonade-decision-submit", this.#onSell);
    this.#elements.reportPanel.addEventListener("lemonade-next-day", this.#onNextDay);
    this.#elements.runTools.addEventListener("lemonade-run-export", this.#onExportRun);
    this.#elements.runTools.addEventListener("lemonade-run-import-file", this.#onImportFile);
    this.#elements.runTools.addEventListener("lemonade-run-reset", this.#onResetRun);
    document.addEventListener("visibilitychange", this.#onVisibilityChange);
    window.addEventListener("pagehide", this.#onPageHide, { once: true });

    this.#render();

    if (options.initialPersistenceError !== null) {
      this.#showPersistenceError(options.initialPersistenceError);
    } else if (this.#persistenceEnabled) {
      this.#queueSave("Run saved locally.");
    } else {
      this.#showPersistenceStatus("Autosave is unavailable in this browser context.");
    }
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#elements.decisionPanel.removeEventListener(
      "lemonade-decision-change",
      this.#onDecisionChange,
    );
    this.#elements.decisionPanel.removeEventListener("lemonade-decision-submit", this.#onSell);
    this.#elements.reportPanel.removeEventListener("lemonade-next-day", this.#onNextDay);
    this.#elements.runTools.removeEventListener("lemonade-run-export", this.#onExportRun);
    this.#elements.runTools.removeEventListener("lemonade-run-import-file", this.#onImportFile);
    this.#elements.runTools.removeEventListener("lemonade-run-reset", this.#onResetRun);
    document.removeEventListener("visibilitychange", this.#onVisibilityChange);
    window.removeEventListener("pagehide", this.#onPageHide);
    this.#clearPresentationTimer();
    this.#clearFeedbackTimers();
    this.#haptics.dispose();
    this.#scene.dispose();
    void this.#audio.dispose();
  }

  readonly #onVisibilityChange = (): void => {
    if (document.visibilityState === "hidden") {
      this.#clearFeedbackTimers();
      this.#haptics.cancel();
      void this.#audio.suspend();
    } else {
      void this.#audio.resume();
    }
  };

  readonly #onPageHide = (): void => {
    this.dispose();
  };

  readonly #onDecisionChange = (event: Event): void => {
    if (!(event instanceof DecisionChangeEvent)) return;

    switch (event.detail.kind) {
      case "glasses":
        this.#glasses = event.detail.value;
        this.#renderDecisionState();
        this.#renderScene();
        break;
      case "signs":
        this.#signs = event.detail.value;
        this.#renderDecisionState();
        this.#renderScene();
        break;
      case "price":
        this.#price = event.detail.value;
        this.#renderDecisionState();
        break;
    }
  };

  readonly #onSell = (): void => {
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
    const previousScaleLevel = operatingScaleForState(this.#game).level;
    this.#phase = Object.freeze({ kind: "report", resolution });
    this.#presentation = "simulation";
    this.#render();
    this.#queueSave("Day report saved locally.");

    void this.#audio.enable().then((enabled) => {
      if (enabled) this.#audio.play("day:submit");
    });
    this.#schedulePurchaseFeedback(resolution);
    if (this.#environment.weather.kind === "thunderstorm") {
      this.#scheduleFeedback(180, "storm:thunder", "storm:thunder");
    }

    this.#schedulePresentation("report", SIMULATION_PRESENTATION_MS, () => {
      this.#playResolutionCues(resolution, previousTier, previousScaleLevel);
    });
  };

  readonly #onNextDay = (): void => {
    if (this.#phase.kind !== "report" || this.#presentation !== "report") return;

    const nextState = this.#phase.resolution.nextState;
    const nextEnvironment = generateEnvironment(nextState.day, this.#random);
    const limits = decisionLimit(nextState);

    this.#game = nextState;
    this.#environment = nextEnvironment;
    this.#glasses = Math.min(this.#glasses, limits.glasses);
    this.#signs = Math.min(this.#signs, limits.signs);
    this.#price = Math.min(this.#price, limits.price);
    this.#phase = Object.freeze({ kind: "deciding" });
    this.#presentation = "forecast";
    this.#render();
    this.#queueSave("Next day saved locally.");

    void this.#audio.enable().then((enabled) => {
      if (!enabled) return;
      this.#audio.play(weatherCue(nextEnvironment.weather.kind));
    });
    if (nextEnvironment.weather.kind === "thunderstorm") {
      this.#scheduleFeedback(160, "storm:thunder", "storm:thunder");
    }

    this.#schedulePresentation("planning", FORECAST_PRESENTATION_MS);
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

  readonly #onImportFile = (event: Event): void => {
    if (!(event instanceof RunImportFileEvent)) return;
    void this.#importFile(event.detail);
  };

  readonly #onResetRun = (): void => {
    if (!this.#persistenceEnabled) return;
    void this.#resetRun();
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
    this.#runStatusMessage = message;
    this.#runErrorMessage = null;
    this.#renderPersistenceState();
  }

  #showPersistenceError(message: string): void {
    this.#runStatusMessage = "Run storage needs attention.";
    this.#runErrorMessage = message;
    this.#renderPersistenceState();
  }

  #renderPersistenceState(): void {
    this.#elements.runTools.model = Object.freeze({
      statusMessage: this.#runStatusMessage,
      errorMessage: this.#runErrorMessage,
      persistenceEnabled: this.#persistenceEnabled,
    });
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

  #clearFeedbackTimers(): void {
    for (const timer of this.#feedbackTimers) window.clearTimeout(timer);
    this.#feedbackTimers = [];
  }

  #emitFeedback(audioCue: AudioCue, hapticCue: HapticCue): void {
    if (this.#disposed) return;
    this.#haptics.play(hapticCue);
    void this.#audio.enable().then((enabled) => {
      if (enabled && !this.#disposed) this.#audio.play(audioCue);
    });
  }

  #scheduleFeedback(delayMs: number, audioCue: AudioCue, hapticCue: HapticCue): void {
    const timer = window.setTimeout(() => {
      this.#feedbackTimers = this.#feedbackTimers.filter((candidate) => candidate !== timer);
      this.#emitFeedback(audioCue, hapticCue);
    }, Math.max(0, delayMs));
    this.#feedbackTimers.push(timer);
  }

  #schedulePurchaseFeedback(resolution: DayResolution): void {
    this.#clearFeedbackTimers();
    const schedule = createPurchaseFeedbackSchedule(
      Number(resolution.entry.sold),
      SIMULATION_PRESENTATION_MS,
    );
    for (const beat of schedule) {
      this.#scheduleFeedback(beat.serveAtMs, "purchase:serve", "purchase:serve");
      this.#scheduleFeedback(beat.paymentAtMs, "purchase:payment", "purchase:payment");
      this.#scheduleFeedback(beat.drinkAtMs, "purchase:drink", "purchase:drink");
    }
  }

  #clearPresentationTimer(): void {
    if (this.#presentationTimer === null) return;
    window.clearTimeout(this.#presentationTimer);
    this.#presentationTimer = null;
  }

  #schedulePresentation(
    next: PresentationPhase,
    delayMs: number,
    afterTransition?: () => void,
  ): void {
    this.#clearPresentationTimer();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.#presentationTimer = window.setTimeout(() => {
      this.#presentationTimer = null;
      if (this.#disposed) return;
      this.#presentation = next;
      this.#render();
      afterTransition?.();
    }, reducedMotion ? 0 : delayMs);
  }

  #playResolutionCues(
    resolution: DayResolution,
    previousTier: GameState["tier"],
    previousScaleLevel: OperatingScaleLevel,
  ): void {
    void this.#audio.enable().then((enabled) => {
      if (!enabled) return;
      this.#audio.play(Number(resolution.entry.net) >= 0 ? "day:profit" : "day:loss");
      const nextScaleLevel = operatingScaleForState(resolution.nextState).level;
      if (
        resolution.nextState.tier !== previousTier ||
        nextScaleLevel > previousScaleLevel
      ) {
        window.setTimeout(() => {
          if (!this.#disposed) this.#audio.play("progression:unlock");
        }, 320);
      }
    });
  }

  #render(): void {
    this.#renderPresentationState();
    this.#renderPersistenceState();
    this.#renderStatus();
    this.#renderDecisionState();
    this.#renderReportState();
    this.#renderScene();

    const entries =
      this.#phase.kind === "report" ? this.#phase.resolution.nextState.ledger : this.#game.ledger;
    renderLedgerHistory(this.#elements.historyHost, entries);
  }

  #renderPresentationState(): void {
    this.#elements.gameShell.dataset["view"] = this.#presentation;

    switch (this.#presentation) {
      case "planning":
        this.#elements.sceneKicker.textContent = "";
        this.#elements.sceneTitle.textContent = "";
        break;
      case "simulation":
        this.#elements.sceneKicker.textContent = `Day ${String(Number(this.#game.day))} · simulation`;
        this.#elements.sceneTitle.textContent = "Lemonsville is open";
        break;
      case "report":
        this.#elements.sceneKicker.textContent = "";
        this.#elements.sceneTitle.textContent = "";
        break;
      case "forecast":
        this.#elements.sceneKicker.textContent = `Day ${String(Number(this.#game.day))} forecast`;
        this.#elements.sceneTitle.textContent = `${weatherLabel[this.#environment.weather.kind]} · Confidence ${String(legacyConfidenceForState(this.#game))}/5`;
        break;
    }
  }

  #renderStatus(): void {
    this.#elements.statusDay.textContent = String(Number(this.#game.day));
    this.#elements.statusCash.textContent = formatMoney(Number(this.#game.cash));
    this.#elements.statusDebt.textContent = formatMoney(Number(this.#game.loanBalance));
    this.#elements.statusDebtGroup.hidden = !(
      this.#game.tier >= 3 || Number(this.#game.loanBalance) > 0
    );

    this.#elements.conditionWeather.textContent = weatherLabel[this.#environment.weather.kind];
    this.#elements.conditionSentiment.textContent = `${String(legacyConfidenceForState(this.#game))} / 5`;
    this.#elements.conditionProduction.textContent = `${formatMoney(Number(this.#game.unitCost))} / glass`;
    this.#elements.conditionAdvertising.textContent = `${formatMoney(Number(this.#game.signCost))} / sign`;
    const scale = operatingScaleForState(this.#game);
    this.#elements.financeTier.textContent =
      `Stand level ${String(scale.level)} · Business tier ${String(this.#game.tier)}`;
    this.#elements.financeSummary.textContent = financeSummary(this.#game);
  }

  #renderDecisionState(): void {
    const limits = decisionLimit(this.#game);
    const affordability = this.#affordability();

    this.#elements.decisionPanel.model = Object.freeze({
      visible: this.#phase.kind === "deciding",
      glasses: this.#glasses,
      signs: this.#signs,
      price: this.#price,
      maxGlasses: limits.glasses,
      maxSigns: limits.signs,
      maxPriceCents: limits.price,
      glassesCostText: `Cost ${formatMoney(this.#glasses * Number(this.#game.unitCost))}`,
      signsCostText: `Cost ${formatMoney(this.#signs * Number(this.#game.signCost))}`,
      priceText: `Price ${formatMoney(this.#price)} / glass`,
      spendText: `Spend ${formatMoney(affordability.spend)} of ${formatMoney(affordability.operatingFunds)} operating funds`,
      affordable: affordability.affordable,
    });
  }

  #renderReportState(): void {
    const report = this.#phase.kind === "report" ? this.#phase.resolution : null;
    this.#elements.reportPanel.model = Object.freeze({
      report,
      weeklyReport: report === null ? null : summarizeCompletedWeek(report.nextState.ledger),
      currentTier: this.#game.tier,
    });
  }

  #renderScene(): void {
    const phase = this.#phase;
    const resolvedDay = phase.kind === "report" ? phase.resolution.entry : null;
    const scenePhase =
      this.#presentation === "simulation" || this.#presentation === "forecast"
        ? this.#presentation
        : "idle";
    this.#scene.update({
      environment: this.#environment,
      confidence: legacyConfidenceForState(this.#game),
      visibleSigns: resolvedDay === null ? this.#signs : Number(resolvedDay.decision.signs),
      phase: scenePhase,
      sold: resolvedDay === null ? 0 : Number(resolvedDay.sold),
      prepared: resolvedDay === null ? this.#glasses : Number(resolvedDay.decision.glasses),
      durationMs:
        scenePhase === "simulation"
          ? SIMULATION_PRESENTATION_MS
          : scenePhase === "forecast"
            ? FORECAST_PRESENTATION_MS
            : 0,
    });
  }
}
