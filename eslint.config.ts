// This repository's own lint. It uses the size limits the projects that will adopt this plugin use today, not the plugin's
// `recommended`: switching those projects (and this one) to `recommended` is follow-up work, done project by project.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  { ignores: ["node_modules/**", "dist/**", "src/testing/typed-fixture/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: { ...globals.node } },
    rules: {
      "max-lines-per-function": ["error", { max: 70, skipBlankLines: true, skipComments: true }],
      "complexity": ["error", 15],
      "max-depth": ["error", 3],
      "max-params": ["error", 4],
      "no-empty": ["error", { allowEmptyCatch: false }],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    // A test file is a list of cases, not a function to keep short.
    files: ["**/*.test.ts"],
    rules: { "max-lines-per-function": "off" },
  },
);
