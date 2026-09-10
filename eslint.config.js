import tseslint from "typescript-eslint";

const typedSources = ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}"];
const scopeTypedConfig = (config) => ({ ...config, files: typedSources });

export default tseslint.config(
  {
    ignores: [
      "app/**",
      "build/**",
      "dist/**",
      "node_modules/**",
      "public/**",
      "*.js",
      "legacy/**",
    ],
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
      "@typescript-eslint/consistent-type-imports": ["error", { "prefer": "type-imports" }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/only-throw-error": "error",
      "@typescript-eslint/prefer-readonly": "error",
      "@typescript-eslint/switch-exhaustiveness-check": [
        "error",
        { "allowDefaultCaseForExhaustiveSwitch": false },
      ],
    },
  },
);
