import type { DailyLedgerEntry } from "@lemonade/simulation";

import { type LedgerPoint, projectLedger, sellThroughBasisPoints } from "./ledger.js";

const CHART_WIDTH = 600;
const CHART_HEIGHT = 260;
const CHART_PADDING_X = 64;
const CHART_PADDING_TOP = 20;
const CHART_PADDING_BOTTOM = 44;
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const formatMoney = (cents: number): string => moneyFormatter.format(cents / 100);

type HistoryMode = "performance" | "inventory" | "balances";

type SeriesSpec = Readonly<{
  key: keyof LedgerPoint;
  label: string;
  className: string;
  legendClass: string;
  format: (value: number) => string;
}>;

type ModeSpec = Readonly<{
  label: string;
  description: string;
  series: readonly SeriesSpec[];
}>;

const HISTORY_MODES: Readonly<Record<HistoryMode, ModeSpec>> = Object.freeze({
  performance: Object.freeze({
    label: "Performance",
    description: "Revenue, expenses, and net result by day",
    series: Object.freeze([
      Object.freeze({
        key: "revenueCents",
        label: "Sales",
        className: "chart-sales",
        legendClass: "legend-sales",
        format: formatMoney,
      }),
      Object.freeze({
        key: "expensesCents",
        label: "Expenses",
        className: "chart-expenses",
        legendClass: "legend-expenses",
        format: formatMoney,
      }),
      Object.freeze({
        key: "netCents",
        label: "Net",
        className: "chart-net",
        legendClass: "legend-net",
        format: formatMoney,
      }),
    ]),
  }),
  inventory: Object.freeze({
    label: "Inventory",
    description: "Prepared inventory and glasses sold by day",
    series: Object.freeze([
      Object.freeze({
        key: "prepared",
        label: "Prepared",
        className: "chart-prepared",
        legendClass: "legend-prepared",
        format: String,
      }),
      Object.freeze({
        key: "sold",
        label: "Sold",
        className: "chart-sold",
        legendClass: "legend-sold",
        format: String,
      }),
    ]),
  }),
  balances: Object.freeze({
    label: "Balances",
    description: "Ending cash and debt by day",
    series: Object.freeze([
      Object.freeze({
        key: "endingCashCents",
        label: "Cash",
        className: "chart-cash",
        legendClass: "legend-cash",
        format: formatMoney,
      }),
      Object.freeze({
        key: "endingDebtCents",
        label: "Debt",
        className: "chart-debt",
        legendClass: "legend-debt",
        format: formatMoney,
      }),
    ]),
  }),
});

const pointPosition = (
  index: number,
  value: number,
  count: number,
  minimum: number,
  maximum: number,
): Readonly<{ x: number; y: number }> => {
  const usableWidth = CHART_WIDTH - CHART_PADDING_X * 2;
  const usableHeight = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;
  const span = Math.max(1, maximum - minimum);
  const denominator = Math.max(1, count - 1);
  return Object.freeze({
    x: CHART_PADDING_X + (index / denominator) * usableWidth,
    y: CHART_PADDING_TOP + (1 - (value - minimum) / span) * usableHeight,
  });
};

const seriesPoints = (
  values: readonly number[],
  minimum: number,
  maximum: number,
): string =>
  values
    .map((value, index) => {
      const point = pointPosition(index, value, values.length, minimum, maximum);
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(" ");

const createElement = <K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className?: string,
): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tagName);
  if (className !== undefined) {
    element.className = className;
  }
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

const modeBounds = (
  points: readonly LedgerPoint[],
  mode: ModeSpec,
): Readonly<{ minimum: number; maximum: number }> => {
  const values = mode.series.flatMap((series) => points.map((point) => Number(point[series.key])));
  const rawMinimum = Math.min(0, ...values);
  const rawMaximum = Math.max(1, ...values);
  const span = Math.max(1, rawMaximum - rawMinimum);
  const padding = span * 0.08;
  return Object.freeze({
    minimum: rawMinimum < 0 ? rawMinimum - padding : 0,
    maximum: rawMaximum + padding,
  });
};

const axisFormat = (mode: HistoryMode, value: number): string =>
  mode === "inventory" ? String(Math.round(value)) : formatMoney(Math.round(value));

const createUnifiedChart = (
  points: readonly LedgerPoint[],
  mode: HistoryMode,
): HTMLElement => {
  const spec = HISTORY_MODES[mode];
  const card = createElement("figure", "chart-card report-explorer-chart");
  card.dataset["mode"] = mode;

  const caption = createElement("figcaption", "report-explorer-caption");
  const title = appendText(caption, "strong", spec.label);
  title.className = "report-explorer-title";
  appendText(caption, "span", spec.description, "report-explorer-description");
  card.append(caption);

  const svg = createSvgElement("svg");
  svg.classList.add("history-chart");
  svg.setAttribute("viewBox", `0 0 ${String(CHART_WIDTH)} ${String(CHART_HEIGHT)}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `${spec.label}: ${spec.description}`);

  const bounds = modeBounds(points, spec);
  const plotBottom = CHART_HEIGHT - CHART_PADDING_BOTTOM;
  const plotRight = CHART_WIDTH - CHART_PADDING_X;

  for (let tick = 0; tick <= 4; tick += 1) {
    const ratio = tick / 4;
    const y = CHART_PADDING_TOP + ratio * (plotBottom - CHART_PADDING_TOP);
    const value = bounds.maximum - ratio * (bounds.maximum - bounds.minimum);

    const grid = createSvgElement("line");
    grid.classList.add("chart-grid-line");
    grid.setAttribute("x1", String(CHART_PADDING_X));
    grid.setAttribute("y1", y.toFixed(1));
    grid.setAttribute("x2", String(plotRight));
    grid.setAttribute("y2", y.toFixed(1));
    svg.append(grid);

    const label = createSvgElement("text");
    label.classList.add("chart-axis-label", "chart-axis-label-y");
    label.setAttribute("x", String(CHART_PADDING_X - 10));
    label.setAttribute("y", (y + 4).toFixed(1));
    label.setAttribute("text-anchor", "end");
    label.textContent = axisFormat(mode, value);
    svg.append(label);
  }

  const axis = createSvgElement("line");
  axis.classList.add("chart-axis");
  axis.setAttribute("x1", String(CHART_PADDING_X));
  axis.setAttribute("y1", String(plotBottom));
  axis.setAttribute("x2", String(plotRight));
  axis.setAttribute("y2", String(plotBottom));
  svg.append(axis);

  points.forEach((point, index) => {
    const x = pointPosition(index, 0, points.length, 0, 1).x;
    const tick = createSvgElement("line");
    tick.classList.add("chart-x-tick");
    tick.setAttribute("x1", x.toFixed(1));
    tick.setAttribute("y1", String(plotBottom));
    tick.setAttribute("x2", x.toFixed(1));
    tick.setAttribute("y2", String(plotBottom + 5));
    svg.append(tick);

    const label = createSvgElement("text");
    label.classList.add("chart-axis-label", "chart-axis-label-x");
    label.setAttribute("x", x.toFixed(1));
    label.setAttribute("y", String(plotBottom + 20));
    label.setAttribute("text-anchor", "middle");
    label.textContent = `Day ${String(point.day)}`;
    svg.append(label);
  });

  if (bounds.minimum < 0 && bounds.maximum > 0) {
    const zero = pointPosition(0, 0, 2, bounds.minimum, bounds.maximum).y;
    const zeroLine = createSvgElement("line");
    zeroLine.classList.add("chart-zero-line");
    zeroLine.setAttribute("x1", String(CHART_PADDING_X));
    zeroLine.setAttribute("y1", zero.toFixed(1));
    zeroLine.setAttribute("x2", String(plotRight));
    zeroLine.setAttribute("y2", zero.toFixed(1));
    svg.append(zeroLine);
  }


  for (const series of spec.series) {
    const values = points.map((point) => Number(point[series.key]));
    const line = createSvgElement("polyline");
    line.setAttribute("class", `chart-line ${series.className}`);
    line.setAttribute("points", seriesPoints(values, bounds.minimum, bounds.maximum));
    svg.append(line);

    values.forEach((value, index) => {
      const position = pointPosition(index, value, values.length, bounds.minimum, bounds.maximum);
      const marker = createSvgElement("circle");
      marker.setAttribute("class", `chart-point ${series.className}`);
      marker.setAttribute("cx", position.x.toFixed(1));
      marker.setAttribute("cy", position.y.toFixed(1));
      marker.setAttribute("r", "5");
      const title = createSvgElement("title");
      title.textContent = `Day ${String(points[index]?.day ?? index + 1)} · ${series.label}: ${series.format(value)}`;
      marker.append(title);
      svg.append(marker);
    });
  }

  card.append(svg);

  const legend = createElement("div", "chart-legend");
  legend.setAttribute("aria-hidden", "true");
  for (const series of spec.series) {
    const item = createElement("span");
    const marker = createElement("i", series.legendClass);
    item.append(marker, document.createTextNode(series.label));
    legend.append(item);
  }
  card.append(legend);

  const latest = points.at(-1);
  if (latest !== undefined) {
    const summary = createElement("dl", "report-explorer-summary");
    for (const series of spec.series) {
      const item = createElement("div");
      appendText(item, "dt", series.label);
      appendText(item, "dd", series.format(Number(latest[series.key])));
      summary.append(item);
    }
    card.append(summary);
  }

  return card;
};

const createHistoryTable = (points: readonly LedgerPoint[]): HTMLDivElement => {
  const wrap = createElement("div", "history-table-wrap");
  const table = createElement("table", "history-table");
  const caption = appendText(
    table,
    "caption",
    "Recent values from the sales-history charts and finance ledger",
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
  const recentPoints = points.slice(-3);
  for (const point of recentPoints) {
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

const setExplorerMode = (
  section: HTMLElement,
  points: readonly LedgerPoint[],
  mode: HistoryMode,
): void => {
  const chartHost = section.querySelector<HTMLElement>(".report-explorer-visual");
  if (chartHost === null) {
    return;
  }
  chartHost.replaceChildren(createUnifiedChart(points, mode));
  for (const button of section.querySelectorAll<HTMLButtonElement>("[data-history-mode]")) {
    const selected = button.dataset["historyMode"] === mode;
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  }
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

  const section = createElement("section", "ledger-history report-explorer");
  section.setAttribute("aria-labelledby", "ledger-history-title");
  section.tabIndex = -1;

  const heading = createElement("header", "history-heading");
  const headingText = createElement("div");
  appendText(headingText, "p", "Business memory", "eyebrow");
  const title = appendText(headingText, "h2", "Report explorer");
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

  const workspace = createElement("div", "report-explorer-workspace");
  const controls = createElement("div", "report-explorer-controls");
  controls.setAttribute("role", "group");
  controls.setAttribute("aria-label", "Report metric");
  for (const mode of Object.keys(HISTORY_MODES) as HistoryMode[]) {
    const button = createElement("button", "report-explorer-tab");
    button.type = "button";
    button.dataset["historyMode"] = mode;
    button.textContent = HISTORY_MODES[mode].label;
    button.setAttribute("aria-pressed", mode === "performance" ? "true" : "false");
    controls.append(button);
  }

  const visual = createElement("div", "report-explorer-visual");
  workspace.append(controls, visual);
  section.append(workspace, createHistoryTable(points));
  host.replaceChildren(section);

  section.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const button = target.closest<HTMLButtonElement>("[data-history-mode]");
    if (button === null) {
      return;
    }
    const mode = button.dataset["historyMode"];
    if (mode === "performance" || mode === "inventory" || mode === "balances") {
      setExplorerMode(section, points, mode);
    }
  });

  setExplorerMode(section, points, "performance");
};
