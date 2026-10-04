import { readdir, readFile, stat } from "node:fs/promises";

const distUrl = new URL("../dist/", import.meta.url);
const assetsUrl = new URL("assets/", distUrl);
const html = await readFile(new URL("index.html", distUrl), "utf8");
const learnHtml = await readFile(new URL("learn/index.html", distUrl), "utf8");
const learnIllustration = await stat(new URL("learn/apple-ii-lab.svg", distUrl));

if (!html.includes("Learn by running the stand.")) {
  throw new Error("GitHub Pages root must render the project landing page.");
}
if (!html.includes('href="/Lemonade/?play=1"')) {
  throw new Error("GitHub Pages root must expose a direct game entry.");
}
if (!html.includes("luum-embed-timeline") || !html.includes("luum-embed-graph")) {
  throw new Error("GitHub Pages root must embed the Lūm timeline and relationship graph.");
}
if (!html.includes("https://xtreemze.github.io/timeline/embed/luum-embed.js")) {
  throw new Error("GitHub Pages root must use the stable Lūm embed module.");
}
if (!html.includes("relationship-fallback")) {
  throw new Error("Lūm embeds must retain semantic fallback content.");
}
if (!html.includes("/Lemonade/assets/")) {
  throw new Error("GitHub Pages bundle must use the /Lemonade/ asset base.");
}

if (!learnHtml.includes("Learn by running the stand.")) {
  throw new Error("GitHub Pages bundle must include the project learning route.");
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
