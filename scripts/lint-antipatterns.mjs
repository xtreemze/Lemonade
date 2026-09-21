import { readdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const styleRoots = [resolve(root, "apps/web/src")];

const rules = Object.freeze([
  {
    id: "mobile-first-media",
    pattern: /@media[^{}]*(?:max-width\s*:|width\s*(?:<|<=))/iu,
    message:
      "Desktop-first width queries are forbidden. Make the narrow layout the default and enhance with ascending width >= queries.",
  },
  {
    id: "modern-media-range",
    pattern: /@media[^{}]*\(\s*min-width\s*:/iu,
    message:
      "Use modern range syntax for responsive enhancement, e.g. @media (width >= 48rem).",
  },
  {
    id: "relative-breakpoints",
    pattern: /@media[^{}]*\bwidth\b[^{}]*\b\d+(?:\.\d+)?px\b/iu,
    message:
      "Responsive breakpoints must use relative units so text zoom and platform scaling remain first-class.",
  },
  {
    id: "dynamic-viewport",
    pattern: /\b(?:min-|max-)?(?:height|width)\s*:\s*[^;{}]*\b100(?:vh|vw)\b/iu,
    message:
      "Legacy 100vh/100vw sizing is forbidden; use dynamic/small viewport units or intrinsic layout.",
  },
  {
    id: "no-overflow-masking",
    pattern: /\boverflow-x\s*:\s*(?:hidden|clip)\b/iu,
    message:
      "Do not hide horizontal overflow to mask responsive layout defects; fix the overflowing component.",
  },
  {
    id: "no-transition-all",
    pattern: /\btransition(?:-property)?\s*:\s*[^;{}]*\ball\b/iu,
    message:
      "Do not transition all properties; name the animated properties to avoid accidental layout/paint work.",
  },
  {
    id: "no-important",
    pattern: /!important\b/iu,
    message:
      "Avoid !important; fix cascade ownership and specificity instead.",
  },
]);

const collectCss = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectCss(path)));
    } else if (entry.isFile() && entry.name.endsWith(".css")) {
      files.push(path);
    }
  }

  return files;
};

const diagnostics = [];

for (const styleRoot of styleRoots) {
  for (const path of await collectCss(styleRoot)) {
    const source = await readFile(path, "utf8");
    const lines = source.split(/\r?\n/u);

    for (const [index, line] of lines.entries()) {
      for (const rule of rules) {
        if (rule.pattern.test(line)) {
          diagnostics.push({
            file: relative(root, path),
            line: index + 1,
            rule: rule.id,
            message: rule.message,
          });
        }
        rule.pattern.lastIndex = 0;
      }
    }
  }
}

if (diagnostics.length > 0) {
  for (const diagnostic of diagnostics) {
    console.error(
      `${diagnostic.file}:${String(diagnostic.line)} [${diagnostic.rule}] ${diagnostic.message}`,
    );
  }

  process.exitCode = 1;
} else {
  console.log(`Anti-pattern lint passed (${String(rules.length)} enforced rules).`);
}
