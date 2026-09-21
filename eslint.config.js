import tseslint from "typescript-eslint";

const typedSources = [
  "apps/**/*.ts",
  "packages/**/*.ts",
  "e2e/**/*.ts",
  "*.config.ts",
];
const scopeTypedConfig = (config) => ({ ...config, files: typedSources });

export default tseslint.config(
  {
    ignores: ["build/**", "dist/**", "node_modules/**", "playwright-report/**", "test-results/**"],
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
  },
  ...tseslint.configs.strictTypeChecked.map(scopeTypedConfig),
  ...tseslint.configs.stylisticTypeChecked.map(scopeTypedConfig),
  {
    files: typedSources,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      eqeqeq: ["error", "always"],
      "no-alert": "error",
      "no-debugger": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-script-url": "error",
      "no-var": "error",
      "object-shorthand": ["error", "always"],
      "prefer-const": ["error", { destructuring: "all" }],
      "prefer-object-has-own": "error",
      "prefer-regex-literals": "error",
      radix: "error",
      "@typescript-eslint/consistent-type-exports": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-import-type-side-effects": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/only-throw-error": "error",
      "@typescript-eslint/prefer-readonly": "error",
      "@typescript-eslint/switch-exhaustiveness-check": [
        "error",
        { allowDefaultCaseForExhaustiveSwitch: false },
      ],
    },
  },
  {
    files: ["packages/simulation/src/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "window", message: "Simulation must not depend on browser state." },
        { name: "document", message: "Simulation must not depend on the DOM." },
        { name: "navigator", message: "Simulation must not depend on device state." },
        { name: "localStorage", message: "Persistence belongs behind an adapter." },
        { name: "sessionStorage", message: "Persistence belongs behind an adapter." },
        { name: "indexedDB", message: "Persistence belongs behind an adapter." },
        { name: "fetch", message: "Network I/O is forbidden in deterministic simulation code." },
        { name: "XMLHttpRequest", message: "Network I/O is forbidden in deterministic simulation code." },
        { name: "WebSocket", message: "Network I/O is forbidden in deterministic simulation code." },
        { name: "AudioContext", message: "Audio belongs behind a presentation adapter." },
        { name: "requestAnimationFrame", message: "Presentation timing must not affect simulation." },
        { name: "setTimeout", message: "Ambient timing must not affect deterministic simulation." },
        { name: "setInterval", message: "Ambient timing must not affect deterministic simulation." },
        { name: "performance", message: "Ambient clock/device state must not enter simulation." },
        { name: "crypto", message: "Randomness must be injected through the simulation RNG contract." },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "lit", message: "UI runtimes are forbidden in the simulation package." },
            { name: "three", message: "Rendering dependencies are forbidden in the simulation package." },
          ],
          patterns: [
            {
              group: [
                "@lemonade/ui",
                "@lemonade/scene",
                "@lemonade/audio",
                "@tauri-apps/*",
                "node:*",
              ],
              message: "Simulation must remain a pure, platform-independent inward dependency.",
            },
          ],
        },
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "Math",
          property: "random",
          message: "Inject a seedable RandomSource; ambient randomness breaks replay determinism.",
        },
        {
          object: "Date",
          property: "now",
          message: "Pass time explicitly; ambient clock state is forbidden in simulation.",
        },
      ],
    },
  },
);
