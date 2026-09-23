import { appendFile, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const artifactRoot = path.resolve("artifacts/e2e-media");
const manifest = JSON.parse(await readFile(path.join(artifactRoot, "manifest.json"), "utf8"));
const MiB = 1024 * 1024;

const requireFile = async (filePath) => {
  const details = await stat(filePath);
  if (!details.isFile() || details.size === 0) {
    throw new Error(`Expected non-empty file: ${filePath}`);
  }
  return details.size;
};

const formatMiB = (bytes) => `${(bytes / MiB).toFixed(2)} MiB`;

for (const formFactor of ["desktop", "mobile"]) {
  for (const feature of manifest.features) {
    const rawBase = path.join(artifactRoot, "raw", formFactor, feature.id);
    await requireFile(`${rawBase}.webm`);
    await requireFile(`${rawBase}.png`);
    await requireFile(`${rawBase}.json`);
  }
}

const budgets = {
  desktop: { perGif: 4 * MiB, total: 16 * MiB },
  mobile: { perGif: 2.5 * MiB, total: 10 * MiB },
};

const summary = ["### Visual showcase media", "", "| Form | GIF | Size |", "| --- | --- | ---: |"];
let combined = 0;

for (const formFactor of ["desktop", "mobile"]) {
  const gifDir = path.join(artifactRoot, "gifs", formFactor);
  const gifNames = (await readdir(gifDir)).filter((name) => name.endsWith(".gif")).sort();
  const expected = manifest.features.map((feature) => `${feature.id}.gif`).sort();
  if (JSON.stringify(gifNames) !== JSON.stringify(expected)) {
    throw new Error(`Expected exactly five ${formFactor} GIFs: ${expected.join(", ")}`);
  }

  let total = 0;
  for (const name of gifNames) {
    const size = await requireFile(path.join(gifDir, name));
    if (size > budgets[formFactor].perGif) {
      throw new Error(
        `${formFactor}/${name} is ${formatMiB(size)}, above the ${formatMiB(budgets[formFactor].perGif)} review budget.`,
      );
    }
    total += size;
    summary.push(`| ${formFactor} | ${name} | ${formatMiB(size)} |`);
  }
  if (total > budgets[formFactor].total) {
    throw new Error(
      `${formFactor} GIF payload is ${formatMiB(total)}, above the ${formatMiB(budgets[formFactor].total)} review budget.`,
    );
  }
  combined += total;
  summary.push(`| **${formFactor} total** | — | **${formatMiB(total)}** |`);
}

if (combined > 24 * MiB) {
  throw new Error(`Combined GIF payload is ${formatMiB(combined)}, above the 24.00 MiB review budget.`);
}
summary.push(`| **combined** | — | **${formatMiB(combined)}** |`, "");

await requireFile(path.join(artifactRoot, "reels", "lemonade-desktop-highlight.mp4"));
await requireFile(path.join(artifactRoot, "reels", "lemonade-mobile-highlight.mp4"));
await requireFile(path.join(artifactRoot, "README-showcase.md"));

console.log(summary.join("\n"));
if (process.env["GITHUB_STEP_SUMMARY"] !== undefined) {
  await appendFile(process.env["GITHUB_STEP_SUMMARY"], `${summary.join("\n")}\n`, "utf8");
}
