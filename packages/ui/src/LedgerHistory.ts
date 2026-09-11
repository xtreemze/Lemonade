import type { DailyLedgerEntry } from "@lemonade/simulation";

import { projectLedger, sellThroughBasisPoints, type LedgerPoint } from "./ledger.js";

const CHART_WIDTH = 720;
const CHART_HEIGHT = 180;
const CHART_PADDING = 18;
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

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

const createElement = <K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className?: string,
): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tagName);
  if (className !== undefined) element.className = className;
  return element;
};

const appendText = <K extends keyof HTMLElementTagNameMap>(
  parent: ParentNode,
  tagName: K,
  text: string,
  className?: string,
): HTMLElementTagNameMap[K] => {
  const element = createElement(tagName, className);
  element.textContent = text;
  parent.append(element);
  return element;
};

const createSvgElement = <K extends keyof SVGElementTagNameMap>(
  tagName: K,
): SVGElementTagNameMap[K] => document.createElementNS(SVG_NAMESPACE, tagName);

const createChart = (
  caption: string,
  ariaLabel: string,
  firstSeries: Readonly<{ className: string; points: string; label: string; legendClass: string }>,
  secondSeries: Readonly<{ className: string; points: string; label: string; legendClass: string }>,
): HTMLElement => {
  const figure = createElement("figure", "chart-card");
  appendText(figure, "figcaption", caption);

  const svg = createSvgElement("svg");
  svg.classList.add("history-chart");
  svg.setAttribute("viewBox", `0 0 ${String(CHART_WIDTH)} ${String(CHART_HEIGHT)}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", ariaLabel);

  const axis = createSvgElement("line");
  axis.classList.add("chart-axis");
  axis.setAttribute("x1", String(CHART_PADDING));
  axis.setAttribute("y1", String(CHART_HEIGHT - CHART_PADDING));
  axis.setAttribute("x2", String(CHART_WIDTH - CHART_PADDING));
  axis.setAttribute("y2", String(CHART_HEIGHT - CHART_PADDING));

  const firstLine = createSvgElement("polyline");
  firstLine.setAttribute("class", `chart-line ${firstSeries.className}`);
  firstLine.setAttribute("points", firstSeries.points);

  const secondLine = createSvgElement("polyline");
  secondLine.setAttribute("class", `chart-line ${secondSeries.className}`);
  secondLine.setAttribute("points", secondSeries.points);

  svg.append(axis, firstLine, secondLine);
  figure.append(svg);

  const legend = createElement("div", "chart-legend");
  legend.setAttribute("aria-hidden", "true");
  for (const series of [firstSeries, secondSeries]) {
    const item = createElement("span");
    const marker = createElement("i", series.legendClass);
    item.append(marker, document.createTextNode(series.label));
    legend.append(item);
  }
  figure.append(legend);
  return figure;
};

const createHistoryTable = (points: readonly LedgerPoint[]): HTMLDivElement => {
  const wrap = createElement("div", "history-table-wrap");
  const table = createElement("table", "history-table");
  const caption = appendText(
    table,
    "caption",
    "Complete values represented by the sales-history charts and finance ledger",
  );
  caption.className = "visually-hidden-table-caption";

  const headers = [
    "Day",
    "Tier",
    "Prepared",
    "Sold",
    "Price",
    "Sales",
    "Finance income",
    "Expenses",
    "Net",
    "Borrowed",
    "Repaid",
    "Cash",
    "Debt",
  ] as const;
  const head = createElement("thead");
  const headRow = createElement("tr");
  for (const header of headers) {
    const cell = appendText(headRow, "th", header);
    cell.scope = "col";
  }
  head.append(headRow);

  const body = createElement("tbody");
  for (const point of points) {
    const row = createElement("tr");
    const day = appendText(row, "th", String(point.day));
    day.scope = "row";
    appendText(row, "td", String(point.tier));
    appendText(row, "td", String(point.prepared));
    appendText(row, "td", String(point.sold));
    appendText(row, "td", formatMoney(point.priceCents));
    appendText(row, "td", formatMoney(point.revenueCents));
    appendText(row, "td", formatMoney(point.financeIncomeCents));
    appendText(row, "td", formatMoney(point.expensesCents));
    appendText(
      row,
      "td",
      `${point.netCents >= 0 ? "+" : "−"}${formatMoney(Math.abs(point.netCents))}`,
    );
    appendText(row, "td", formatMoney(point.borrowedCents));
    appendText(row, "td", formatMoney(point.repaidCents));
    appendText(row, "td", formatMoney(point.endingCashCents));
    appendText(row, "td", formatMoney(point.endingDebtCents));
    body.append(row);
  }

  table.append(head, body);
  wrap.append(table);
  return wrap;
};

export const renderLedgerHistory = (
  host: HTMLElement,
  entries: readonly DailyLedgerEntry[],
): void => {
  const points = projectLedger(entries);
  const latest = points.at(-1);
  const first = points.at(0);
  if (latest === undefined || first === undefined) {
    host.replaceChildren();
    return;
  }

  const balances = balanceTrends(points);
  const inventory = inventoryTrends(points);
  const section = createElement("section", "ledger-history");
  section.setAttribute("aria-labelledby", "ledger-history-title");

  const heading = createElement("header", "history-heading");
  const headingText = createElement("div");
  appendText(headingText, "p", "Business memory", "eyebrow");
  const title = appendText(headingText, "h2", "Sales history");
  title.id = "ledger-history-title";
  const latestSellThrough = createElement("p");
  latestSellThrough.append(
    document.createTextNode("Latest sell-through "),
    Object.assign(document.createElement("strong"), {
      textContent: `${(sellThroughBasisPoints(latest) / 100).toFixed(0)}%`,
    }),
  );
  heading.append(headingText, latestSellThrough);
  section.append(heading);

  const chartGrid = createElement("div", "chart-grid");
  chartGrid.append(
    createChart(
      "Cash and debt over time",
      `Balance history from ${formatMoney(first.endingCashCents)} cash and ${formatMoney(first.endingDebtCents)} debt to ${formatMoney(latest.endingCashCents)} cash and ${formatMoney(latest.endingDebtCents)} debt`,
      Object.freeze({
        className: "chart-cash",
        points: balances.cash,
        label: "Cash",
        legendClass: "legend-cash",
      }),
      Object.freeze({
        className: "chart-debt",
        points: balances.debt,
        label: "Debt",
        legendClass: "legend-debt",
      }),
    ),
    createChart(
      "Prepared vs sold",
      `Inventory history across ${String(points.length)} day${points.length === 1 ? "" : "s"}`,
      Object.freeze({
        className: "chart-prepared",
        points: inventory.prepared,
        label: "Prepared",
        legendClass: "legend-prepared",
      }),
      Object.freeze({
        className: "chart-sold",
        points: inventory.sold,
        label: "Sold",
        legendClass: "legend-sold",
      }),
    ),
  );
  section.append(chartGrid, createHistoryTable(points));
  host.replaceChildren(section);
};
