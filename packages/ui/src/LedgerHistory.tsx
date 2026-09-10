import type { DailyLedgerEntry } from "@lemonade/simulation";

import { projectLedger, sellThroughBasisPoints, type LedgerPoint } from "./ledger.js";

const CHART_WIDTH = 720;
const CHART_HEIGHT = 180;
const CHART_PADDING = 18;
const CHART_VIEW_BOX = "0 0 720 180";

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const formatMoney = (cents: number): string => moneyFormatter.format(cents / 100);

const seriesPoints = (
  values: readonly number[],
  minValue: number,
  maxValue: number,
): string => {
  if (values.length === 0) return "";

  const usableWidth = CHART_WIDTH - CHART_PADDING * 2;
  const usableHeight = CHART_HEIGHT - CHART_PADDING * 2;
  const span = Math.max(1, maxValue - minValue);
  const denominator = Math.max(1, values.length - 1);

  return values
    .map((value, index) => {
      const x = CHART_PADDING + (index / denominator) * usableWidth;
      const y = CHART_PADDING + (1 - (value - minValue) / span) * usableHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
};

const balanceTrends = (
  points: readonly LedgerPoint[],
): Readonly<{ cash: string; debt: string }> => {
  const cash = points.map((point) => point.endingCashCents);
  const debt = points.map((point) => point.endingDebtCents);
  const maximum = Math.max(1, ...cash, ...debt);
  return Object.freeze({
    cash: seriesPoints(cash, 0, maximum),
    debt: seriesPoints(debt, 0, maximum),
  });
};

const inventoryTrends = (
  points: readonly LedgerPoint[],
): Readonly<{ prepared: string; sold: string }> => {
  const prepared = points.map((point) => point.prepared);
  const sold = points.map((point) => point.sold);
  const maximum = Math.max(1, ...prepared, ...sold);
  return Object.freeze({
    prepared: seriesPoints(prepared, 0, maximum),
    sold: seriesPoints(sold, 0, maximum),
  });
};

export type LedgerHistoryProps = Readonly<{
  entries: readonly DailyLedgerEntry[];
}>;

export const LedgerHistory = ({ entries }: LedgerHistoryProps) => {
  const points = projectLedger(entries);
  if (points.length === 0) return null;

  const balances = balanceTrends(points);
  const inventory = inventoryTrends(points);
  const latest = points.at(-1);
  const first = points.at(0);
  if (latest === undefined || first === undefined) return null;

  return (
    <section className="ledger-history" aria-labelledby="ledger-history-title">
      <header className="history-heading">
        <div>
          <p className="eyebrow">Business memory</p>
          <h2 id="ledger-history-title">Sales history</h2>
        </div>
        <p>
          Latest sell-through <strong>{(sellThroughBasisPoints(latest) / 100).toFixed(0)}%</strong>
        </p>
      </header>

      <div className="chart-grid">
        <figure className="chart-card">
          <figcaption>Cash and debt over time</figcaption>
          <svg
            className="history-chart"
            viewBox={CHART_VIEW_BOX}
            role="img"
            aria-label={`Balance history from ${formatMoney(first.endingCashCents)} cash and ${formatMoney(first.endingDebtCents)} debt to ${formatMoney(latest.endingCashCents)} cash and ${formatMoney(latest.endingDebtCents)} debt`}
          >
            <line
              className="chart-axis"
              x1={CHART_PADDING}
              y1={CHART_HEIGHT - CHART_PADDING}
              x2={CHART_WIDTH - CHART_PADDING}
              y2={CHART_HEIGHT - CHART_PADDING}
            />
            <polyline className="chart-line chart-cash" points={balances.cash} />
            <polyline className="chart-line chart-debt" points={balances.debt} />
          </svg>
          <div className="chart-legend" aria-hidden="true">
            <span><i className="legend-cash" />Cash</span>
            <span><i className="legend-debt" />Debt</span>
          </div>
        </figure>

        <figure className="chart-card">
          <figcaption>Prepared vs sold</figcaption>
          <svg
            className="history-chart"
            viewBox={CHART_VIEW_BOX}
            role="img"
            aria-label={`Inventory history across ${String(points.length)} day${points.length === 1 ? "" : "s"}`}
          >
            <line
              className="chart-axis"
              x1={CHART_PADDING}
              y1={CHART_HEIGHT - CHART_PADDING}
              x2={CHART_WIDTH - CHART_PADDING}
              y2={CHART_HEIGHT - CHART_PADDING}
            />
            <polyline className="chart-line chart-prepared" points={inventory.prepared} />
            <polyline className="chart-line chart-sold" points={inventory.sold} />
          </svg>
          <div className="chart-legend" aria-hidden="true">
            <span><i className="legend-prepared" />Prepared</span>
            <span><i className="legend-sold" />Sold</span>
          </div>
        </figure>
      </div>

      <div className="history-table-wrap">
        <table className="history-table">
          <caption>Complete values represented by the sales-history charts and finance ledger</caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Tier</th>
              <th scope="col">Prepared</th>
              <th scope="col">Sold</th>
              <th scope="col">Price</th>
              <th scope="col">Sales</th>
              <th scope="col">Finance income</th>
              <th scope="col">Expenses</th>
              <th scope="col">Net</th>
              <th scope="col">Borrowed</th>
              <th scope="col">Repaid</th>
              <th scope="col">Cash</th>
              <th scope="col">Debt</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.day}>
                <th scope="row">{point.day}</th>
                <td>{point.tier}</td>
                <td>{point.prepared}</td>
                <td>{point.sold}</td>
                <td>{formatMoney(point.priceCents)}</td>
                <td>{formatMoney(point.revenueCents)}</td>
                <td>{formatMoney(point.financeIncomeCents)}</td>
                <td>{formatMoney(point.expensesCents)}</td>
                <td>{point.netCents >= 0 ? "+" : "−"}{formatMoney(Math.abs(point.netCents))}</td>
                <td>{formatMoney(point.borrowedCents)}</td>
                <td>{formatMoney(point.repaidCents)}</td>
                <td>{formatMoney(point.endingCashCents)}</td>
                <td>{formatMoney(point.endingDebtCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
