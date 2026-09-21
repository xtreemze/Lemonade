import { LitElement, html } from "lit";
import type { DayEnvironment, DayResolution, GameState } from "@lemonade/simulation";
import type { WeeklyReport } from "@lemonade/ui";

export type RunToolsModel = Readonly<{
  statusMessage: string;
  errorMessage: string | null;
  persistenceEnabled: boolean;
}>;

const DEFAULT_RUN_TOOLS_MODEL: RunToolsModel = Object.freeze({
  statusMessage: "",
  errorMessage: null,
  persistenceEnabled: true,
});

export class RunImportFileEvent extends CustomEvent<File> {
  constructor(file: File) {
    super("lemonade-run-import-file", { detail: file, bubbles: true, composed: true });
  }
}

export class LemonadeRunTools extends LitElement {
  static override properties = {
    model: { attribute: false },
  };

  declare model: RunToolsModel;

  constructor() {
    super();
    this.model = DEFAULT_RUN_TOOLS_MODEL;
  }

  protected override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("click", this.#onClick);
    this.addEventListener("change", this.#onChange);
  }

  override disconnectedCallback(): void {
    this.removeEventListener("click", this.#onClick);
    this.removeEventListener("change", this.#onChange);
    super.disconnectedCallback();
  }

  readonly #onClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;

    switch (target.id) {
      case "export-run":
        this.dispatchEvent(new Event("lemonade-run-export", { bubbles: true, composed: true }));
        break;
      case "import-run": {
        if (!this.model.persistenceEnabled) return;
        const input = this.querySelector("#import-file");
        if (!(input instanceof HTMLInputElement)) {
          throw new TypeError("Expected run import file input.");
        }
        input.click();
        break;
      }
      case "reset-run":
        if (!this.model.persistenceEnabled) return;
        this.dispatchEvent(new Event("lemonade-run-reset", { bubbles: true, composed: true }));
        break;
    }
  };

  readonly #onChange = (event: Event): void => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.id !== "import-file") return;
    const file = input.files?.item(0);
    input.value = "";
    if (file !== null && file !== undefined) {
      this.dispatchEvent(new RunImportFileEvent(file));
    }
  };

  protected override render() {
    const { statusMessage, errorMessage, persistenceEnabled } = this.model;
    return html`
      <section class="run-tools" aria-label="Run data">
        <div class="run-tools-copy">
          <p class="eyebrow">Run data</p>
          <p id="run-status" class="run-status" role="status" aria-live="polite">${statusMessage}</p>
          <p id="run-error" class="inline-error" role="alert" ?hidden=${errorMessage === null}>
            ${errorMessage ?? ""}
          </p>
        </div>
        <div class="run-actions">
          <button id="export-run" class="utility-button" type="button">
            Export run
          </button>
          <button
            id="import-run"
            class="utility-button"
            type="button"
            ?disabled=${!persistenceEnabled}
           
          >
            Import run
          </button>
          <input
            id="import-file"
            type="file"
            accept="application/json,.json"
            hidden
           
          />
          <button
            id="reset-run"
            class="utility-button utility-button-danger"
            type="button"
            ?disabled=${!persistenceEnabled}
           
          >
            Reset run
          </button>
        </div>
      </section>
    `;
  }
}

export type DecisionKind = "glasses" | "signs" | "price";

export type DecisionChangeDetail = Readonly<{
  kind: DecisionKind;
  value: number;
}>;

export class DecisionChangeEvent extends CustomEvent<DecisionChangeDetail> {
  constructor(detail: DecisionChangeDetail) {
    super("lemonade-decision-change", { detail, bubbles: true, composed: true });
  }
}

export type DecisionPanelModel = Readonly<{
  visible: boolean;
  glasses: number;
  signs: number;
  price: number;
  maxGlasses: number;
  maxSigns: number;
  glassesCostText: string;
  signsCostText: string;
  priceText: string;
  spendText: string;
  affordable: boolean;
}>;

const DEFAULT_DECISION_MODEL: DecisionPanelModel = Object.freeze({
  visible: true,
  glasses: 0,
  signs: 0,
  price: 10,
  maxGlasses: 0,
  maxSigns: 0,
  glassesCostText: "Cost $0.00",
  signsCostText: "Cost $0.00",
  priceText: "Price $0.10 / glass",
  spendText: "",
  affordable: true,
});

export class LemonadeDecisionPanel extends LitElement {
  static override properties = {
    model: { attribute: false },
  };

  declare model: DecisionPanelModel;

  constructor() {
    super();
    this.model = DEFAULT_DECISION_MODEL;
  }

  protected override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  #decisionBounds(kind: DecisionKind): readonly [minimum: number, maximum: number] {
    switch (kind) {
      case "glasses":
        return [0, this.model.maxGlasses];
      case "signs":
        return [0, this.model.maxSigns];
      case "price":
        return [1, 100];
    }
  }

  #decisionValue(kind: DecisionKind): number {
    switch (kind) {
      case "glasses":
        return this.model.glasses;
      case "signs":
        return this.model.signs;
      case "price":
        return this.model.price;
    }
  }

  #emitDecision(kind: DecisionKind, event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      throw new TypeError("Expected decision input.");
    }
    if (!Number.isFinite(input.valueAsNumber)) return;

    const [minimum, maximum] = this.#decisionBounds(kind);
    const value = Math.min(maximum, Math.max(minimum, Math.trunc(input.valueAsNumber)));
    if (input.type === "number" && input.valueAsNumber !== value) {
      input.value = String(value);
    }
    this.dispatchEvent(new DecisionChangeEvent(Object.freeze({ kind, value })));
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("input", this.#onInput);
    this.addEventListener("change", this.#onChange);
    this.addEventListener("submit", this.#onSubmit);
  }

  override disconnectedCallback(): void {
    this.removeEventListener("input", this.#onInput);
    this.removeEventListener("change", this.#onChange);
    this.removeEventListener("submit", this.#onSubmit);
    super.disconnectedCallback();
  }

  readonly #onInput = (event: Event): void => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;

    switch (input.name) {
      case "glasses":
        this.#emitDecision("glasses", event);
        break;
      case "signs":
        this.#emitDecision("signs", event);
        break;
      case "price":
        this.#emitDecision("price", event);
        break;
    }
  };

  readonly #onChange = (event: Event): void => {
    const input = event.target;
    if (
      !(input instanceof HTMLInputElement) ||
      input.type !== "number" ||
      Number.isFinite(input.valueAsNumber)
    ) {
      return;
    }

    switch (input.name) {
      case "glasses":
      case "signs":
      case "price":
        input.value = String(this.#decisionValue(input.name));
        break;
    }
  };

  readonly #onSubmit = (event: Event): void => {
    if (!(event.target instanceof HTMLFormElement)) return;
    event.preventDefault();
    if (!this.model.affordable) return;
    this.dispatchEvent(new Event("lemonade-decision-submit", { bubbles: true, composed: true }));
  };

  protected override render() {
    const model = this.model;
    return html`
      <form id="decision-panel" class="decision-panel" ?hidden=${!model.visible}>
        <header class="panel-heading">
          <div>
            <p class="eyebrow">Set today’s plan</p>
            <h2>Three decisions. Then sell.</h2>
          </div>
          <p class=${model.affordable ? "spend" : "spend spend-warning"}>${model.spendText}</p>
        </header>

        <div class="decision-control">
          <span>
            <strong id="glasses-label">Glasses</strong>
            <small id="glasses-help">Inventory prepared before demand is known</small>
          </span>
          <label class="decision-exact" for="glasses-exact">
            <span id="glasses-exact-label">Exact</span>
            <input
              id="glasses-exact"
              name="glasses"
              type="number"
              inputmode="numeric"
              min="0"
              step="1"
              .max=${String(model.maxGlasses)}
              .value=${String(model.glasses)}
              aria-labelledby="glasses-label glasses-exact-label"
              aria-describedby="glasses-help glasses-cost"
            />
          </label>
          <div class="decision-slider">
            <input
              id="glasses"
              name="glasses"
              type="range"
              min="0"
              step="1"
              .max=${String(model.maxGlasses)}
              .value=${String(model.glasses)}
              aria-labelledby="glasses-label"
              aria-describedby="glasses-help glasses-cost"
            />
            <output id="glasses-cost" class="decision-cost" for="glasses glasses-exact">
              ${model.glassesCostText}
            </output>
          </div>
        </div>

        <div class="decision-control">
          <span>
            <strong id="signs-label">Signs</strong>
            <small id="signs-help">Advertising helps demand with diminishing returns</small>
          </span>
          <label class="decision-exact" for="signs-exact">
            <span id="signs-exact-label">Exact</span>
            <input
              id="signs-exact"
              name="signs"
              type="number"
              inputmode="numeric"
              min="0"
              step="1"
              .max=${String(model.maxSigns)}
              .value=${String(model.signs)}
              aria-labelledby="signs-label signs-exact-label"
              aria-describedby="signs-help signs-cost"
            />
          </label>
          <div class="decision-slider">
            <input
              id="signs"
              name="signs"
              type="range"
              min="0"
              step="1"
              .max=${String(model.maxSigns)}
              .value=${String(model.signs)}
              aria-labelledby="signs-label"
              aria-describedby="signs-help signs-cost"
            />
            <output id="signs-cost" class="decision-cost" for="signs signs-exact">
              ${model.signsCostText}
            </output>
          </div>
        </div>

        <div class="decision-control">
          <span>
            <strong id="price-label">Price</strong>
            <small id="price-help">Higher margin can sharply reduce demand</small>
          </span>
          <label class="decision-exact" for="price-exact">
            <span id="price-exact-label">Exact cents</span>
            <span class="decision-exact-value">
              <input
                id="price-exact"
                name="price"
                type="number"
                inputmode="numeric"
                min="1"
                max="100"
                step="1"
                .value=${String(model.price)}
                aria-labelledby="price-label price-exact-label"
                aria-describedby="price-help price-value"
              />
              <span aria-hidden="true">¢</span>
            </span>
          </label>
          <div class="decision-slider">
            <input
              id="price"
              name="price"
              type="range"
              min="1"
              max="100"
              step="1"
              .value=${String(model.price)}
              aria-labelledby="price-label"
              aria-describedby="price-help price-value"
            />
            <output id="price-value" class="decision-cost" for="price price-exact">
              ${model.priceText}
            </output>
          </div>
        </div>

        <p id="decision-error" class="inline-error" role="alert" ?hidden=${model.affordable}>
          This plan exceeds available cash and credit. Reduce glasses or signs.
        </p>
        <button id="sell-button" class="sell-button" type="submit" ?disabled=${!model.affordable}>
          Sell for the day
        </button>
      </form>
    `;
  }
}

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

export type DayReportModel = Readonly<{
  report: DayResolution | null;
  weeklyReport: WeeklyReport | null;
  currentTier: GameState["tier"];
}>;

const DEFAULT_REPORT_MODEL: DayReportModel = Object.freeze({
  report: null,
  weeklyReport: null,
  currentTier: 0,
});

export class LemonadeDayReport extends LitElement {
  static override properties = {
    model: { attribute: false },
  };

  declare model: DayReportModel;

  constructor() {
    super();
    this.model = DEFAULT_REPORT_MODEL;
  }

  protected override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("click", this.#onClick);
  }

  override disconnectedCallback(): void {
    this.removeEventListener("click", this.#onClick);
    super.disconnectedCallback();
  }

  readonly #onClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement) || target.id !== "next-button") return;
    this.dispatchEvent(new Event("lemonade-next-day", { bubbles: true, composed: true }));
  };

  protected override render() {
    const { report, weeklyReport, currentTier } = this.model;
    if (report === null) {
      return html`<section
        id="report-panel"
        class="report-panel"
        aria-live="polite"
        aria-labelledby="report-title"
        hidden
      ></section>`;
    }

    const entry = report.entry;
    const net = Number(entry.net);
    const progressed = report.nextState.tier !== currentTier;

    return html`
      <section id="report-panel" class="report-panel" aria-live="polite" aria-labelledby="report-title">
        <header class="panel-heading">
          <div>
            <p id="report-eyebrow" class="eyebrow">Day ${String(Number(entry.day))} report</p>
            <h2 id="report-title">
              ${String(Number(entry.sold))} of ${String(Number(entry.decision.glasses))} sold
            </h2>
          </div>
          <strong id="report-net" class=${net >= 0 ? "profit" : "loss"}>
            ${net >= 0 ? "+" : "−"}${formatMoney(Math.abs(net))}
          </strong>
        </header>

        <dl class="results-grid">
          <div><dt>Sales</dt><dd id="report-sales">${formatMoney(Number(entry.revenue))}</dd></div>
          <div><dt>Expenses</dt><dd id="report-expenses">${formatMoney(Number(entry.expenses))}</dd></div>
          <div><dt>Ending cash</dt><dd id="report-cash">${formatMoney(Number(entry.endingCash))}</dd></div>
          <div>
            <dt>Ending debt</dt>
            <dd id="report-debt">${formatMoney(Number(entry.endingLoanBalance))}</dd>
          </div>
        </dl>

        <div class="ledger-breakdown">
          <h3>Day ledger</h3>
          <table>
            <caption>Credits, operating expenses and financing movements for this day</caption>
            <tbody id="report-ledger-lines">
              ${entry.lines.map(
                (line) => html`
                  <tr>
                    <th scope="row">${line.label}</th>
                    <td class=${line.direction === "credit" ? "ledger-credit" : "ledger-debit"}>
                      ${line.direction === "credit" ? "+" : "−"}${formatMoney(Number(line.amount))}
                    </td>
                  </tr>
                `,
              )}
            </tbody>
          </table>
        </div>

        ${weeklyReport === null
          ? null
          : html`
              <section
                class="weekly-report"
                aria-labelledby="weekly-report-title"
              >
                <header class="weekly-report-heading">
                  <div>
                    <p class="eyebrow">
                      Weekly report · Days ${String(weeklyReport.startDay)}–${String(weeklyReport.endDay)}
                    </p>
                    <h3 id="weekly-report-title">Week ${String(weeklyReport.weekNumber)} results</h3>
                  </div>
                  <strong class=${weeklyReport.netCents >= 0 ? "weekly-profit" : "weekly-loss"}>
                    ${weeklyReport.netCents >= 0 ? "+" : "−"}${formatMoney(Math.abs(weeklyReport.netCents))}
                  </strong>
                </header>

                <dl class="weekly-results-grid">
                  <div><dt>Revenue</dt><dd>${formatMoney(weeklyReport.revenueCents)}</dd></div>
                  <div><dt>Expenses</dt><dd>${formatMoney(weeklyReport.expensesCents)}</dd></div>
                  <div><dt>Sold</dt><dd>${String(weeklyReport.sold)} / ${String(weeklyReport.prepared)}</dd></div>
                  <div>
                    <dt>Sell-through</dt>
                    <dd>${(weeklyReport.sellThroughBasisPoints / 100).toFixed(0)}%</dd>
                  </div>
                  <div>
                    <dt>Average daily net</dt>
                    <dd>
                      ${weeklyReport.averageDailyNetCents >= 0 ? "+" : "−"}${formatMoney(
                        Math.abs(weeklyReport.averageDailyNetCents),
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Profitable days</dt>
                    <dd>${String(weeklyReport.profitableDays)} / 7</dd>
                  </div>
                  <div><dt>Closing cash</dt><dd>${formatMoney(weeklyReport.endingCashCents)}</dd></div>
                  <div><dt>Closing debt</dt><dd>${formatMoney(weeklyReport.endingDebtCents)}</dd></div>
                </dl>

                <div class="weekly-highlights" aria-label="Week highlights">
                  <p>
                    <span>Best day</span>
                    <strong>
                      Day ${String(weeklyReport.bestDay.day)} ·
                      ${weeklyReport.bestDay.netCents >= 0 ? "+" : "−"}${formatMoney(
                        Math.abs(weeklyReport.bestDay.netCents),
                      )}
                    </strong>
                  </p>
                  <p>
                    <span>Lowest day</span>
                    <strong>
                      Day ${String(weeklyReport.worstDay.day)} ·
                      ${weeklyReport.worstDay.netCents >= 0 ? "+" : "−"}${formatMoney(
                        Math.abs(weeklyReport.worstDay.netCents),
                      )}
                    </strong>
                  </p>
                </div>
              </section>
            `}

        <p id="report-event" class="event-note">${eventLabel[entry.environment.event.kind]}</p>
        <p id="report-progression" class="progression-note" ?hidden=${!progressed}>
          ${progressed
            ? `Tier ${String(report.nextState.tier)} unlocks tomorrow. New finance rules will be shown before you sell.`
            : ""}
        </p>
        <button id="next-button" class="next-button" type="button">
          Plan next day
        </button>
      </section>
    `;
  }
}

if (customElements.get("lemonade-run-tools") === undefined) {
  customElements.define("lemonade-run-tools", LemonadeRunTools);
}
if (customElements.get("lemonade-decision-panel") === undefined) {
  customElements.define("lemonade-decision-panel", LemonadeDecisionPanel);
}
if (customElements.get("lemonade-day-report") === undefined) {
  customElements.define("lemonade-day-report", LemonadeDayReport);
}

declare global {
  interface HTMLElementTagNameMap {
    "lemonade-run-tools": LemonadeRunTools;
    "lemonade-decision-panel": LemonadeDecisionPanel;
    "lemonade-day-report": LemonadeDayReport;
  }
}
