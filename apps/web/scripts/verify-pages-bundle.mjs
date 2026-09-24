import { readdir, readFile, stat } from "node:fs/promises";

const distUrl = new URL("../dist/", import.meta.url);
const assetsUrl = new URL("assets/", distUrl);
const html = await readFile(new URL("index.html", distUrl), "utf8");

if (!html.includes("/Lemonade/assets/")) {
  throw new Error("GitHub Pages bundle must use the /Lemonade/ asset base.");
}

const entryMatch = html.match(/\/assets\/(index-[^"'<>]+\.js)/u);
if (entryMatch?.[1] === undefined) {
  throw new Error("Unable to identify the production entry chunk.");
}

const assets = await readdir(assetsUrl);
const sceneChunks = assets.filter((name) => /^scene-runtime-[^/]+\.js$/u.test(name));
if (sceneChunks.length !== 1) {
  throw new Error(`Expected one lazy scene runtime chunk, found ${String(sceneChunks.length)}.`);
}

const entryBytes = (await stat(new URL(entryMatch[1], assetsUrl))).size;
const sceneBytes = (await stat(new URL(sceneChunks[0], assetsUrl))).size;

const ENTRY_BUDGET_BYTES = 100_000;
const SCENE_BUDGET_BYTES = 550_000;

if (entryBytes > ENTRY_BUDGET_BYTES) {
  throw new Error(
    `Critical entry chunk is ${String(entryBytes)} bytes; budget is ${String(ENTRY_BUDGET_BYTES)}.`,
  );
}
if (sceneBytes > SCENE_BUDGET_BYTES) {
  throw new Error(
    `Lazy scene chunk is ${String(sceneBytes)} bytes; budget is ${String(SCENE_BUDGET_BYTES)}.`,
  );
}

console.log(
  `Bundle budgets passed: entry ${String(entryBytes)} B, lazy scene ${String(sceneBytes)} B.`,
);
