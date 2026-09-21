import { LitElement, html } from "lit";
import type { DayEnvironment, DayResolution, GameState } from "@lemonade/simulation";

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

  model: RunToolsModel = DEFAULT_RUN_TOOLS_MODEL;

  protected override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  readonly #onExport = (): void => {
    this.dispatchEvent(new Event("lemonade-run-export", { bubbles: true, composed: true }));
  };

  readonly #onImport = (): void => {
    if (!this.model.persistenceEnabled) return;
    const input = this.querySelector("#import-file");
    if (!(input instanceof HTMLInputElement)) {
      throw new TypeError("Expected run import file input.");
    }
    input.click();
  };

  readonly #onImportFileChange = (event: Event): void => {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) {
      throw new TypeError("Expected run import file input change target.");
    }
    const file = input.files?.item(0);
    input.value = "";
    if (file !== null && file !== undefined) {
      this.dispatchEvent(new RunImportFileEvent(file));
    }
  };

  readonly #onReset = (): void => {
    if (!this.model.persistenceEnabled) return;
    this.dispatchEvent(new Event("lemonade-run-reset", { bubbles: true, composed: true }));
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
          <button id="export-run" class="utility-button" type="button" @click=${this.#onExport}>
            Export run
          </button>
          <button
            id="import-run"
            class="utility-button"
            type="button"
            ?disabled=${!persistenceEnabled}
            @click=${this.#onImport}
          >
            Import run
          </button>
          <input
            id="import-file"
            type="file"
            accept="application/json,.json"
            hidden
            @change=${this.#onImportFileChange}
          />
          <button
            id="reset-run"
            class="utility-button utility-button-danger"
            type="button"
            ?disabled=${!persistenceEnabled}
            @click=${this.#onReset}
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
  spendText: "",
  affordable: true,
});

export class LemonadeDecisionPanel extends LitElement {
  static override properties = {
    model: { attribute: false },
  };

  model: DecisionPanelModel = DEFAULT_DECISION_MODEL;

  protected override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  #emitDecision(kind: DecisionKind, event: Event): void {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) {
      throw new TypeError("Expected decision range input.");
    }
    if (!Number.isFinite(input.valueAsNumber)) return;
    this.dispatchEvent(new DecisionChangeEvent(Object.freeze({ kind, value: input.valueAsNumber })));
  }

  readonly #onGlassesInput = (event: Event): void => {
    this.#emitDecision("glasses", event);
  };

  readonly #onSignsInput = (event: Event): void => {
    this.#emitDecision("signs", event);
  };

  readonly #onPriceInput = (event: Event): void => {
    this.#emitDecision("price", event);
  };

  readonly #onSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    if (!this.model.affordable) return;
    this.dispatchEvent(new Event("lemonade-decision-submit", { bubbles: true, composed: true }));
  };

  protected override render() {
    const model = this.model;
    return html`
      <form id="decision-panel" class="decision-panel" ?hidden=${!model.visible} @submit=${this.#onSubmit}>
        <header class="panel-heading">
          <div>
            <p class="eyebrow">Set today’s plan</p>
            <h2>Three decisions. Then sell.</h2>
          </div>
          <p class=${model.affordable ? "spend" : "spend spend-warning"}>${model.spendText}</p>
        </header>

        <label class="decision-control" for="glasses">
          <span><strong>Glasses</strong><small>Inventory prepared before demand is known</small></span>
          <output id="glasses-output" for="glasses">${String(model.glasses)}</output>
          <input
            id="glasses"
            name="glasses"
            type="range"
            min="0"
            step="1"
            .max=${String(model.maxGlasses)}
            .value=${String(model.glasses)}
            @input=${this.#onGlassesInput}
          />
        </label>

        <label class="decision-control" for="signs">
          <span><strong>Signs</strong><small>Advertising helps demand with diminishing returns</small></span>
          <output id="signs-output" for="signs">${String(model.signs)}</output>
          <input
            id="signs"
            name="signs"
            type="range"
            min="0"
            step="1"
            .max=${String(model.maxSigns)}
            .value=${String(model.signs)}
            @input=${this.#onSignsInput}
          />
        </label>

        <label class="decision-control" for="price">
          <span><strong>Price</strong><small>Higher margin can sharply reduce demand</small></span>
          <output id="price-output" for="price">${formatMoney(model.price)}</output>
          <input
            id="price"
            name="price"
            type="range"
            min="1"
            max="100"
            step="1"
            .value=${String(model.price)}
            @input=${this.#onPriceInput}
          />
        </label>

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
  currentTier: GameState["tier"];
}>;

const DEFAULT_REPORT_MODEL: DayReportModel = Object.freeze({
  report: null,
  currentTier: 0,
});

export class LemonadeDayReport extends LitElement {
  static override properties = {
    model: { attribute: false },
  };

  model: DayReportModel = DEFAULT_REPORT_MODEL;

  protected override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  readonly #onNextDay = (): void => {
    this.dispatchEvent(new Event("lemonade-next-day", { bubbles: true, composed: true }));
  };

  protected override render() {
    const { report, currentTier } = this.model;
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

        <p id="report-event" class="event-note">${eventLabel[entry.environment.event.kind]}</p>
        <p id="report-progression" class="progression-note" ?hidden=${!progressed}>
          ${progressed
            ? `Tier ${String(report.nextState.tier)} unlocks tomorrow. New finance rules will be shown before you sell.`
            : ""}
        </p>
        <button id="next-button" class="next-button" type="button" @click=${this.#onNextDay}>
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
