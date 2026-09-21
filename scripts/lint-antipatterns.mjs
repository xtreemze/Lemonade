import { readdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const styleRoots = [resolve(root, "apps"), resolve(root, "packages")];
const ignoredDirectories = new Set(["build", "dist", "node_modules"]);

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
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;

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

const addDiagnostic = (file, line, rule, message) => {
  diagnostics.push({ file, line, rule, message });
};

const lintHoverCapability = (file, source) => {
  const lines = source.split(/\r?\n/u);
  const mediaStack = [];
  let depth = 0;

  for (const [index, line] of lines.entries()) {
    const hasFineHoverContext = mediaStack.some(
      ({ condition }) =>
        condition.includes("hover: hover") && condition.includes("pointer: fine"),
    );

    if (line.includes(":hover") && !hasFineHoverContext) {
      addDiagnostic(
        file,
        index + 1,
        "capability-gated-hover",
        "Hover-only decoration must be gated by @media (hover: hover) and (pointer: fine) so touch remains first-class.",
      );
    }

    const mediaMatch = line.match(/@media\s*([^{}]+)\{/iu);
    const opens = (line.match(/\{/gu) ?? []).length;
    const closes = (line.match(/\}/gu) ?? []).length;

    if (mediaMatch?.[1] !== undefined) {
      mediaStack.push({
        condition: mediaMatch[1],
        depth: depth + 1,
      });
    }

    depth += opens - closes;

    while (mediaStack.length > 0 && mediaStack.at(-1).depth > depth) {
      mediaStack.pop();
    }
  }
};

for (const styleRoot of styleRoots) {
  for (const path of await collectCss(styleRoot)) {
    const source = await readFile(path, "utf8");
    const file = relative(root, path);
    const lines = source.split(/\r?\n/u);

    for (const [index, line] of lines.entries()) {
      for (const rule of rules) {
        if (rule.pattern.test(line)) {
          addDiagnostic(file, index + 1, rule.id, rule.message);
        }
        rule.pattern.lastIndex = 0;
      }
    }

    lintHoverCapability(file, source);
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
  console.log(`Anti-pattern lint passed (${String(rules.length + 1)} enforced rules).`);
}
