import { readFile, readdir, stat } from "node:fs/promises";

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
const threeSceneChunks = assets.filter((name) =>
  /^scene-runtime-(?!babylon-)[^/]+\.js$/u.test(name),
);
const babylonSceneChunks = assets.filter((name) =>
  /^scene-runtime-babylon-[^/]+\.js$/u.test(name),
);
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
const threeSceneBytes = (
  await stat(new URL(threeSceneChunks[0], assetsUrl))
).size;
const babylonSceneBytes = (
  await stat(new URL(babylonSceneChunks[0], assetsUrl))
).size;

const ENTRY_BUDGET_BYTES = 100_000;
const THREE_SCENE_BUDGET_BYTES = 550_000;
// Migration-only ceiling: Babylon is not the default runtime yet. #200 must
// establish the final production Babylon payload budget before cutover.
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
