import { readdir, readFile, stat } from "node:fs/promises";

const distUrl = new URL("../dist/", import.meta.url);
const assetsUrl = new URL("assets/", distUrl);
const html = await readFile(new URL("index.html", distUrl), "utf8");
const learnHtml = await readFile(new URL("learn/index.html", distUrl), "utf8");
const learnIllustration = await stat(new URL("learn/apple-ii-lab.svg", distUrl));

if (!html.includes("Run your lemonade stand.")) {
  throw new Error("GitHub Pages root must render the player guide.");
}
if (!html.includes('href="/Lemonade/?play=1"')) {
  throw new Error("GitHub Pages root must expose a direct game entry.");
}
if (!html.includes("/Lemonade/assets/")) {
  throw new Error("GitHub Pages bundle must use the /Lemonade/ asset base.");
}

for (const [name, document] of [
  ["root", html],
  ["learning", learnHtml],
]) {
  if (!document.includes('<iframe')) {
    throw new Error(`GitHub Pages ${name} presentation must embed the playable game.`);
  }
  if (!document.includes('src="/Lemonade/?play=1"')) {
    throw new Error(`GitHub Pages ${name} presentation must embed explicit game mode.`);
  }
  if (!document.includes('title="Playable Lemonade simulation"')) {
    throw new Error(`GitHub Pages ${name} game iframe must have an accessible title.`);
  }
}

if (!learnHtml.includes("Run your lemonade stand.")) {
  throw new Error("GitHub Pages bundle must include the player-guide route.");
}
for (const [name, document] of [
  ["root", html],
  ["learning", learnHtml],
]) {
  for (const required of [
    "One day takes six steps",
    "Everything you control",
    "Read the day before you spend",
    "How to read the day report",
    "Starter tactics",
    "The math is part of the fun",
    "How the Apple II game differs",
    "signs² / log1p(signs)",
  ]) {
    if (!document.includes(required)) {
      throw new Error(`GitHub Pages ${name} player guide is missing: ${required}`);
    }
  }
  for (const developerCopy of [
    "Shipping compatibility model",
    "finite customer funnel",
    "ruleset-v4",
    "potentialDemand =",
  ]) {
    if (document.includes(developerCopy)) {
      throw new Error(`GitHub Pages ${name} must not expose developer-facing onboarding copy: ${developerCopy}`);
    }
  }
}
if (!learnHtml.includes('href="/Lemonade/?play=1"')) {
  throw new Error("Learning route must link to explicit game mode.");
}
if (!learnIllustration.isFile() || learnIllustration.size === 0) {
  throw new Error("Learning route must include the Apple II lab illustration.");
}

const entryMatch = html.match(/\/assets\/(index-[^"'<>]+\.js)/u);
if (entryMatch?.[1] === undefined) {
  throw new Error("Unable to identify the production entry chunk.");
}

const assets = await readdir(assetsUrl);
const threeSceneChunks = assets.filter((name) =>
  /^scene-runtime-(?!babylon-)[^/]+\.js$/u.test(name),
);
const babylonSceneChunks = assets.filter((name) => /^scene-runtime-babylon-[^/]+\.js$/u.test(name));
if (threeSceneChunks.length !== 1) {
  throw new Error(
    `Expected one lazy Three scene runtime chunk, found ${String(threeSceneChunks.length)}.`,
  );
}
if (babylonSceneChunks.length !== 1) {
  throw new Error(
    `Expected one lazy Babylon scene runtime chunk, found ${String(babylonSceneChunks.length)}.`,
  );
}

const entryBytes = (await stat(new URL(entryMatch[1], assetsUrl))).size;
const threeSceneBytes = (await stat(new URL(threeSceneChunks[0], assetsUrl))).size;
const babylonSceneBytes = (await stat(new URL(babylonSceneChunks[0], assetsUrl))).size;

const ENTRY_BUDGET_BYTES = 100_000;
const THREE_SCENE_BUDGET_BYTES = 550_000;
// Migration-only ceiling. #200 must establish the final Babylon production
// payload budget before the compatibility renderer is removed.
const BABYLON_MIGRATION_BUDGET_BYTES = 1_100_000;

if (entryBytes > ENTRY_BUDGET_BYTES) {
  throw new Error(
    `Critical entry chunk is ${String(entryBytes)} bytes; budget is ${String(ENTRY_BUDGET_BYTES)}.`,
  );
}
if (threeSceneBytes > THREE_SCENE_BUDGET_BYTES) {
  throw new Error(
    `Lazy Three scene chunk is ${String(threeSceneBytes)} bytes; budget is ${String(THREE_SCENE_BUDGET_BYTES)}.`,
  );
}
if (babylonSceneBytes > BABYLON_MIGRATION_BUDGET_BYTES) {
  throw new Error(
    `Lazy Babylon migration chunk is ${String(babylonSceneBytes)} bytes; migration ceiling is ${String(BABYLON_MIGRATION_BUDGET_BYTES)}.`,
  );
}

console.log(
  [
    `Bundle budgets passed: entry ${String(entryBytes)} B`,
    `Three scene ${String(threeSceneBytes)} B`,
    `Babylon migration scene ${String(babylonSceneBytes)} B`,
  ].join(", "),
);
