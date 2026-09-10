import { useEffect, useMemo, useState, type SyntheticEvent } from "react";

import { createProceduralAudioEngine, weatherCue } from "@lemonade/audio";
import {
  availableOperatingFunds,
  createInitialState,
  createSeededRandom,
  dayNumber,
  financeRulesForTier,
  generateEnvironment,
  glassCount,
  moneyCents,
  predictableFixedObligations,
  seed,
  signCount,
  simulateDay,
  type DayEnvironment,
  type DayResolution,
  type GameState,
} from "@lemonade/simulation";
import { LedgerHistory } from "@lemonade/ui";

import { LemonsvilleScene } from "./LemonsvilleScene.js";

type Phase =
  | Readonly<{ kind: "deciding" }>
  | Readonly<{ kind: "report"; resolution: DayResolution }>;

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

export const App = () => {
  const [random] = useState(() => createSeededRandom(seed(0x1e_ad_2026)));
  const [audio] = useState(() => createProceduralAudioEngine());
  const [game, setGame] = useState<GameState>(() => createInitialState());
  const [environment, setEnvironment] = useState<DayEnvironment>(() =>
    generateEnvironment(dayNumber(1), random),
  );
  const [phase, setPhase] = useState<Phase>({ kind: "deciding" });
  const [glasses, setGlasses] = useState(20);
  const [signs, setSigns] = useState(1);
  const [price, setPrice] = useState(10);

  const limits = useMemo(() => decisionLimit(game), [game]);
  const fixedObligations = Number(predictableFixedObligations(game));
  const operatingFunds = Number(availableOperatingFunds(game));
  const spend =
    glasses * Number(game.unitCost) + signs * Number(game.signCost) + fixedObligations;
  const affordable = spend <= operatingFunds;

  useEffect(() => {
    const onVisibilityChange = (): void => {
      if (document.visibilityState === "hidden") {
        void audio.suspend();
      } else {
        void audio.resume();
      }
    };
    const onPageHide = (): void => {
      void audio.dispose();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide, { once: true });
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [audio]);

  const sell = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!affordable || phase.kind !== "deciding") return;

    const resolution = simulateDay(
      game,
      Object.freeze({
        glasses: glassCount(glasses),
        signs: signCount(signs),
        price: moneyCents(price),
      }),
      environment,
    );
    setPhase(Object.freeze({ kind: "report", resolution }));

    void audio.enable().then((enabled) => {
      if (!enabled) return;
      audio.play("day:submit");
      const resultCue = Number(resolution.entry.net) >= 0 ? "day:profit" : "day:loss";
      window.setTimeout(() => {
        audio.play(resultCue);
      }, 220);
      if (resolution.nextState.tier !== game.tier) {
        window.setTimeout(() => {
          audio.play("progression:unlock");
        }, 520);
      }
    });
  };

  const planNextDay = (): void => {
    if (phase.kind !== "report") return;

    const nextState = phase.resolution.nextState;
    const nextEnvironment = generateEnvironment(nextState.day, random);
    setGame(nextState);
    setEnvironment(nextEnvironment);
    setGlasses((current) => Math.min(current, decisionLimit(nextState).glasses));
    setSigns((current) => Math.min(current, decisionLimit(nextState).signs));
    setPhase(Object.freeze({ kind: "deciding" }));

    void audio.enable().then((enabled) => {
      if (enabled) audio.play(weatherCue(nextEnvironment.weather.kind));
    });
  };

  const sceneSigns =
    phase.kind === "report" ? Number(phase.resolution.entry.decision.signs) : signs;
  const sceneSold = phase.kind === "report" ? Number(phase.resolution.entry.sold) : 0;
  const scenePrepared =
    phase.kind === "report" ? Number(phase.resolution.entry.decision.glasses) : glasses;
  const historyEntries =
    phase.kind === "report" ? phase.resolution.nextState.ledger : game.ledger;

  return (
    <main className="game-shell">
      <header className="topline">
        <div>
          <p className="eyebrow">Lemonsville neighborhood market</p>
          <h1>Lemonade</h1>
        </div>
        <dl className="cash-readout" aria-label="Business status">
          <div>
            <dt>Day</dt>
            <dd>{Number(game.day)}</dd>
          </div>
          <div>
            <dt>Cash</dt>
            <dd>{formatMoney(Number(game.cash))}</dd>
          </div>
          {(game.tier >= 3 || Number(game.loanBalance) > 0) && (
            <div>
              <dt>Debt</dt>
              <dd>{formatMoney(Number(game.loanBalance))}</dd>
            </div>
          )}
        </dl>
      </header>

      <section className="conditions" aria-labelledby="conditions-title">
        <div>
          <p className="eyebrow" id="conditions-title">
            Today’s conditions
          </p>
          <strong>{weatherLabel[environment.weather.kind]}</strong>
        </div>
        <div>
          <span>Market sentiment</span>
          <strong>{sentimentLabel[environment.sentiment.kind]}</strong>
        </div>
        <div>
          <span>Production</span>
          <strong>{formatMoney(Number(game.unitCost))} / glass</strong>
        </div>
        <div>
          <span>Advertising</span>
          <strong>{formatMoney(Number(game.signCost))} / sign</strong>
        </div>
      </section>

      <aside className="obligation-strip" aria-label="Business finance rules">
        <strong>Business tier {game.tier}</strong>
        <span>{financeSummary(game)}</span>
      </aside>

      <LemonsvilleScene
        environment={environment}
        visibleSigns={sceneSigns}
        phase={phase.kind}
        sold={sceneSold}
        prepared={scenePrepared}
      />

      {phase.kind === "deciding" ? (
        <form className="decision-panel" onSubmit={sell}>
          <header className="panel-heading">
            <div>
              <p className="eyebrow">Set today’s plan</p>
              <h2>Three decisions. Then sell.</h2>
            </div>
            <p className={affordable ? "spend" : "spend spend-warning"}>
              Spend {formatMoney(spend)} of {formatMoney(operatingFunds)} operating funds
            </p>
          </header>

          <label className="decision-control" htmlFor="glasses">
            <span>
              <strong>Glasses</strong>
              <small>Inventory prepared before demand is known</small>
            </span>
            <output htmlFor="glasses">{glasses}</output>
            <input
              id="glasses"
              name="glasses"
              type="range"
              min="0"
              max={limits.glasses}
              step="1"
              value={glasses}
              onChange={(event) => {
                setGlasses(event.currentTarget.valueAsNumber);
              }}
            />
          </label>

          <label className="decision-control" htmlFor="signs">
            <span>
              <strong>Signs</strong>
              <small>Advertising helps demand with diminishing returns</small>
            </span>
            <output htmlFor="signs">{signs}</output>
            <input
              id="signs"
              name="signs"
              type="range"
              min="0"
              max={limits.signs}
              step="1"
              value={signs}
              onChange={(event) => {
                setSigns(event.currentTarget.valueAsNumber);
              }}
            />
          </label>

          <label className="decision-control" htmlFor="price">
            <span>
              <strong>Price</strong>
              <small>Higher margin can sharply reduce demand</small>
            </span>
            <output htmlFor="price">{formatMoney(price)}</output>
            <input
              id="price"
              name="price"
              type="range"
              min="1"
              max="100"
              step="1"
              value={price}
              onChange={(event) => {
                setPrice(event.currentTarget.valueAsNumber);
              }}
            />
          </label>

          {!affordable && (
            <p className="inline-error" role="alert">
              This plan exceeds available cash and credit. Reduce glasses or signs.
            </p>
          )}

          <button className="sell-button" type="submit" disabled={!affordable}>
            Sell for the day
          </button>
        </form>
      ) : (
        <section className="report-panel" aria-live="polite" aria-labelledby="report-title">
          <header className="panel-heading">
            <div>
              <p className="eyebrow">Day {Number(phase.resolution.entry.day)} report</p>
              <h2 id="report-title">
                {Number(phase.resolution.entry.sold)} of {Number(phase.resolution.entry.decision.glasses)} sold
              </h2>
            </div>
            <strong className={Number(phase.resolution.entry.net) >= 0 ? "profit" : "loss"}>
              {Number(phase.resolution.entry.net) >= 0 ? "+" : "−"}
              {formatMoney(Math.abs(Number(phase.resolution.entry.net)))}
            </strong>
          </header>

          <dl className="results-grid">
            <div>
              <dt>Sales</dt>
              <dd>{formatMoney(Number(phase.resolution.entry.revenue))}</dd>
            </div>
            <div>
              <dt>Expenses</dt>
              <dd>{formatMoney(Number(phase.resolution.entry.expenses))}</dd>
            </div>
            <div>
              <dt>Ending cash</dt>
              <dd>{formatMoney(Number(phase.resolution.entry.endingCash))}</dd>
            </div>
            <div>
              <dt>Ending debt</dt>
              <dd>{formatMoney(Number(phase.resolution.entry.endingLoanBalance))}</dd>
            </div>
          </dl>

          <div className="ledger-breakdown">
            <h3>Day ledger</h3>
            <table>
              <caption>Credits, operating expenses and financing movements for this day</caption>
              <tbody>
                {phase.resolution.entry.lines.map((line, index) => (
                  <tr key={`${line.kind}-${String(index)}`}>
                    <th scope="row">{line.label}</th>
                    <td className={line.direction === "credit" ? "ledger-credit" : "ledger-debit"}>
                      {line.direction === "credit" ? "+" : "−"}
                      {formatMoney(Number(line.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="event-note">{eventLabel[phase.resolution.entry.environment.event.kind]}</p>
          {phase.resolution.nextState.tier !== game.tier && (
            <p className="progression-note">
              Tier {phase.resolution.nextState.tier} unlocks tomorrow. New finance rules will be shown before you sell.
            </p>
          )}
          <button className="next-button" type="button" onClick={planNextDay}>
            Plan next day
          </button>
        </section>
      )}

      <LedgerHistory entries={historyEntries} />
    </main>
  );
};
