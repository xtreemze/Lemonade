import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stylesPath = resolve(root, "apps/web/src/styles.css");
const componentsPath = resolve(root, "apps/web/src/components.ts");

const [styles, components] = await Promise.all([
  readFile(stylesPath, "utf8"),
  readFile(componentsPath, "utf8"),
]);

const failures = [];
const fail = (rule, message) => failures.push({ rule, message });

const requireMatch = (source, pattern, rule, message) => {
  if (!pattern.test(source)) fail(rule, message);
  pattern.lastIndex = 0;
};

const stateSelector =
  String.raw`\.game-shell\[data-view="planning"\],[\s\S]*?\.game-shell\[data-view="report"\],[\s\S]*?\.game-shell\[data-view="simulation"\],[\s\S]*?\.game-shell\[data-view="forecast"\]\s*\{([\s\S]*?)\}`;

const stateMatch = styles.match(new RegExp(stateSelector, "u"));
if (stateMatch?.[1] === undefined) {
  fail(
    "mobile-flow-shared-shell",
    "All four primary states must share one mobile-baseline shell rule.",
  );
} else {
  const declarations = stateMatch[1];
  for (const [property, pattern] of [
    ["position: fixed", /\bposition\s*:\s*fixed\s*;/u],
    ["inset: 0", /\binset\s*:\s*0\s*;/u],
    ["width: 100%", /\bwidth\s*:\s*100%\s*;/u],
    ["height: 100dvh", /\bheight\s*:\s*100dvh\s*;/u],
    ["max-height: 100dvh", /\bmax-height\s*:\s*100dvh\s*;/u],
    ["overflow: hidden", /\boverflow\s*:\s*hidden\s*;/u],
  ]) {
    if (!pattern.test(declarations)) {
      fail(
        "mobile-flow-shared-shell",
        `Mobile flow shell must declare ${property}; mobile states may not fall back to document scrolling.`,
      );
    }
  }
}

requireMatch(
  styles,
  /html:has\(\.game-shell\[data-view="planning"\]\)[\s\S]*?body:has\(\.game-shell\[data-view="forecast"\]\)\s*\{[\s\S]*?height\s*:\s*100dvh\s*;[\s\S]*?overflow\s*:\s*hidden\s*;/u,
  "mobile-root-viewport-lock",
  "The document root and body must be viewport-locked for every mobile flow state.",
);

if (/@media[^{}]*(?:max-width\s*:|width\s*(?:<|<=))/iu.test(styles)) {
  fail(
    "mobile-first-only",
    "Desktop-first width queries are forbidden. Mobile behavior must be the default and larger layouts must use width >= enhancement queries.",
  );
}

const flowButtons = [...components.matchAll(/<button\b([^>]*\bflow-action-button\b[^>]*)>([\s\S]*?)<\/button>/gu)];
if (flowButtons.length < 2) {
  fail(
    "semantic-icon-actions",
    "Primary flow controls must use the shared flow-action-button contract.",
  );
}

for (const [index, match] of flowButtons.entries()) {
  const attributes = match[1] ?? "";
  const body = match[2] ?? "";
  if (!/\baria-label\s*=\s*"[^"]+"/u.test(attributes)) {
    fail(
      "semantic-icon-actions",
      `Flow action ${String(index + 1)} must keep an accessible aria-label when visible wording is removed.`,
    );
  }
  if (!/<(?:svg|img)\b/u.test(body)) {
    fail(
      "semantic-icon-actions",
      `Flow action ${String(index + 1)} must communicate through semantic iconography.`,
    );
  }
  const visibleText = body
    .replace(/<svg\b[\s\S]*?<\/svg>/gu, "")
    .replace(/<img\b[^>]*\/?\s*>/gu, "")
    .replace(/<[^>]+>/gu, "")
    .replace(/\$\{[^}]+\}/gu, "")
    .trim();
  if (visibleText.length > 0) {
    fail(
      "icon-only-primary-actions",
      `Flow action ${String(index + 1)} contains visible wording ("${visibleText}"). Primary mobile flow actions must remain icon-only.`,
    );
  }
}

requireMatch(
  styles,
  /\.game-shell\[data-view="planning"\][\s\S]*?\.simulation-button\s*\{[\s\S]*?margin\s*:\s*[^;]*auto[^;]*0\s*;/u,
  "bottom-docked-primary-action",
  "The planning action must remain horizontally centered and bottom-docked.",
);

requireMatch(
  styles,
  /\.game-shell\[data-view="report"\][\s\S]*?\.next-day-button\s*\{[\s\S]*?margin\s*:\s*auto\s+auto\s+0\s*;/u,
  "bottom-docked-primary-action",
  "The report action must remain horizontally centered and bottom-docked.",
);

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`[mobile-contract:${failure.rule}] ${failure.message}`);
  }
  process.exitCode = 1;
} else {
  console.log("Mobile contract lint passed: fullscreen, no-scroll, mobile-first, icon-only actions enforced.");
}
