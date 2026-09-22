import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stylesPath = resolve(root, "apps/web/src/styles.css");
const componentsPath = resolve(root, "apps/web/src/components.ts");
const mobileSpecPath = resolve(root, "e2e/mobile-contract.spec.ts");
const workflowPath = resolve(root, ".github/workflows/ci.yml");
const indexPath = resolve(root, "apps/web/index.html");

const [styles, components, mobileSpec, workflow, indexHtml] = await Promise.all([
  readFile(stylesPath, "utf8"),
  readFile(componentsPath, "utf8"),
  readFile(mobileSpecPath, "utf8"),
  readFile(workflowPath, "utf8"),
  readFile(indexPath, "utf8"),
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
  /\.game-shell\[data-view="planning"\][\s\S]*?\.simulation-button\s*\{(?=[^}]*\bposition\s*:\s*absolute\s*;)(?=[^}]*\bleft\s*:\s*50%\s*;)(?=[^}]*\bbottom\s*:)(?=[^}]*\btransform\s*:\s*translateX\(-50%\)\s*;)[^}]*\}/u,
  "bottom-docked-primary-action",
  "The planning action must remain absolutely anchored, horizontally centered, and bottom-docked.",
);

requireMatch(
  styles,
  /\.game-shell\[data-view="report"\][\s\S]*?\.next-day-button\s*\{(?=[^}]*\bposition\s*:\s*absolute\s*;)(?=[^}]*\bleft\s*:\s*50%\s*;)(?=[^}]*\bbottom\s*:)(?=[^}]*\btransform\s*:\s*translateX\(-50%\)\s*;)[^}]*\}/u,
  "bottom-docked-primary-action",
  "The report action must remain absolutely anchored, horizontally centered, and bottom-docked.",
);

for (const [width, height] of [
  [320, 568],
  [360, 740],
  [390, 844],
  [430, 932],
  [768, 1024],
  [568, 320],
  [740, 360],
  [844, 390],
  [932, 430],
  [1024, 768],
]) {
  const literal = `width: ${String(width)}, height: ${String(height)}`;
  if (!mobileSpec.includes(literal)) {
    fail(
      "mobile-viewport-matrix",
      `Mobile browser contract must retain the ${String(width)}×${String(height)} viewport.`,
    );
  }
}

requireMatch(
  mobileSpec,
  /browser\.newContext\([\s\S]*?viewport:\s*\{\s*width:\s*viewport\.width,\s*height:\s*viewport\.height\s*\}[\s\S]*?screen:\s*\{\s*width:\s*viewport\.width,\s*height:\s*viewport\.height\s*\}[\s\S]*?hasTouch:\s*true[\s\S]*?isMobile:\s*true/u,
  "exact-mobile-emulation",
  "Every mobile contract case must create its browser context with matching viewport and screen dimensions plus touch/mobile emulation.",
);

requireMatch(
  mobileSpec,
  /screenWidth:\s*window\.screen\.width[\s\S]*?screenHeight:\s*window\.screen\.height[\s\S]*?screenWidth:\s*viewport\.width[\s\S]*?screenHeight:\s*viewport\.height/u,
  "exact-mobile-emulation",
  "The browser contract must assert the effective CSS viewport and emulated screen dimensions against the requested matrix.",
);

if (/\.setViewportSize\s*\(/u.test(mobileSpec)) {
  fail(
    "no-post-creation-mobile-resize",
    "Mobile contract tests may not resize an already-created mobile page; create the context at the target viewport so device-width semantics remain exact.",
  );
}

requireMatch(
  mobileSpec,
  /overflowViolations[\s\S]*?overflowY[\s\S]*?overflowX[\s\S]*?verticallyClipped[\s\S]*?expect\(contract\.overflowViolations\)\.toEqual\(\[\]\)/u,
  "no-nested-scroll-or-clipping",
  "Browser certification must reject nested scrolling and vertically clipped content, not only document scrolling.",
);

requireMatch(
  mobileSpec,
  /viewportViolations[\s\S]*?getBoundingClientRect[\s\S]*?window\.innerWidth[\s\S]*?window\.innerHeight[\s\S]*?expect\(contract\.viewportViolations\)\.toEqual\(\[\]\)/u,
  "no-offscreen-flow-content",
  "Browser certification must reject rendered flow content that escapes any viewport edge.",
);

requireMatch(
  mobileSpec,
  /interactiveViolations[\s\S]*?\.flow-action-button, \.game-slider[\s\S]*?rect\.width < 44[\s\S]*?rect\.height < 44[\s\S]*?expect\(contract\.interactiveViolations\)\.toEqual\(\[\]\)/u,
  "minimum-touch-target",
  "Primary mobile actions and game sliders must retain at least a 44×44 CSS-pixel interaction target.",
);

if (/\b(?:test|test\.describe)\.(?:skip|fixme|fail)\b/u.test(mobileSpec)) {
  fail(
    "no-mobile-contract-test-exemptions",
    "The mobile contract suite may not skip, fixme, or expected-fail any viewport. Fix the layout instead.",
  );
}

if (/mobile-contract-(?:ignore|disable|exempt)|mobile-contract:\s*(?:ignore|disable|exempt)/iu.test(
  [styles, components, mobileSpec].join("\n"),
)) {
  fail(
    "no-mobile-contract-source-exemptions",
    "Mobile contract ignore/disable/exempt markers are forbidden. The fullscreen rule has no mobile exceptions.",
  );
}

requireMatch(
  styles,
  /@media\s*\(width\s*>=\s*47\.5625rem\)\s*and\s*\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)\s*\{[\s\S]*?\.game-shell\[data-view="planning"\][\s\S]*?\.game-shell\[data-view="report"\]/u,
  "desktop-release-requires-fine-pointer",
  "The mobile fullscreen contract may only be released for a sufficiently wide fine-pointer/hover environment; wide touch devices remain mobile.",
);

requireMatch(
  indexHtml,
  /<meta\s+name="viewport"\s+content="[^"]*width=device-width[^"]*viewport-fit=cover[^"]*"\s*\/>/u,
  "viewport-safe-area-contract",
  "The app viewport meta tag must retain width=device-width and viewport-fit=cover.",
);

requireMatch(
  workflow,
  /pnpm\s+verify:mobile/u,
  "ci-mobile-gate",
  "CI must run the combined static and browser mobile contract as an explicit merge gate.",
);

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`[mobile-contract:${failure.rule}] ${failure.message}`);
  }
  process.exitCode = 1;
} else {
  console.log("Mobile contract lint passed: fullscreen, no-scroll, no-clipping, touch-target, mobile-first, icon-only actions enforced with no exemptions.");
}
