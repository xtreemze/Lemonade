import { useMemo, useState, type FormEvent } from "react";

import {
  createInitialState,
  createSeededRandom,
  dayNumber,
  generateEnvironment,
  glassCount,
  moneyCents,
  seed,
  signCount,
  simulateDay,
  type DayEnvironment,
  type DayResolution,
  type GameState,
} from "@lemonade/simulation";

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

const decisionLimit = (state: GameState): Readonly<{ glasses: number; signs: number }> =>
  Object.freeze({
    glasses: Math.min(250, Math.floor(Number(state.cash) / Number(state.unitCost))),
    signs: Math.min(25, Math.floor(Number(state.cash) / Number(state.signCost))),
  });

export const App = () => {
  const [random] = useState(() => createSeededRandom(seed(0x1e_ad_2026)));
  const [game, setGame] = useState<GameState>(() => createInitialState());
  const [environment, setEnvironment] = useState<DayEnvironment>(() =>
    generateEnvironment(dayNumber(1), random),
  );
  const [phase, setPhase] = useState<Phase>({ kind: "deciding" });
  const [glasses, setGlasses] = useState(20);
  const [signs, setSigns] = useState(1);
  const [price, setPrice] = useState(10);

  const limits = useMemo(() => decisionLimit(game), [game]);
  const spend = glasses * Number(game.unitCost) + signs * Number(game.signCost);
  const affordable = spend <= Number(game.cash);

  const sell = (event: FormEvent<HTMLFormElement>): void => {
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
  };

  const planNextDay = (): void => {
    if (phase.kind !== "report") return;

    const nextState = phase.resolution.nextState;
    setGame(nextState);
    setEnvironment(generateEnvironment(nextState.day, random));
    setGlasses((current) => Math.min(current, decisionLimit(nextState).glasses));
    setSigns((current) => Math.min(current, decisionLimit(nextState).signs));
    setPhase(Object.freeze({ kind: "deciding" }));
  };

  const sceneSigns =
    phase.kind === "report" ? Number(phase.resolution.entry.decision.signs) : signs;
  const sceneSold = phase.kind === "report" ? Number(phase.resolution.entry.sold) : 0;
  const scenePrepared =
    phase.kind === "report" ? Number(phase.resolution.entry.decision.glasses) : glasses;

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
              Spend {formatMoney(spend)} of {formatMoney(Number(game.cash))}
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
              onChange={(event) => setGlasses(event.currentTarget.valueAsNumber)}
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
              onChange={(event) => setSigns(event.currentTarget.valueAsNumber)}
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
              onChange={(event) => setPrice(event.currentTarget.valueAsNumber)}
            />
          </label>

          {!affordable && (
            <p className="inline-error" role="alert">
              This plan costs more cash than the stand has. Reduce glasses or signs.
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
              <dt>Revenue</dt>
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
              <dt>Potential demand</dt>
              <dd>{Number(phase.resolution.entry.potentialDemand)}</dd>
            </div>
          </dl>

          <p className="event-note">{eventLabel[phase.resolution.entry.environment.event.kind]}</p>
          <button className="next-button" type="button" onClick={planNextDay}>
            Plan next day
          </button>
        </section>
      )}
    </main>
  );
};
