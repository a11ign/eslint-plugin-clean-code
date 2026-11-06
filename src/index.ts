/**
 * The ESLint plugin: its rules and its two flat configs.
 *
 * - `recommended`: every custom rule that needs only syntax, and the built-in rules the catalog maps to the book, for
 *   JavaScript, TypeScript, JSX and TSX. TypeScript files are parsed with typescript-eslint's parser, JavaScript with ESLint's own.
 * - `recommended-type-checked`: `recommended`, plus the rules that need type information, with typescript-eslint's
 *   `projectService` turned on.
 * - `ai`: opt-in and standalone, the five `ai-` rules for the habits of AI-generated code (ADR 0001), with the same parsers as
 *   `recommended`. Stack it after `recommended`, or use it alone.
 */
import type { ESLint, Linter } from "eslint";
import tseslint from "typescript-eslint";
import plugin from "./plugin.ts";
import {
  AI_RULES, AI_TEST_FILE_OFF, ALL_FILES, BUILT_IN_RULES, JS_UNUSED_VARS, PLUGIN_PREFIX, SYNTAX_RULES, TEST_FILES, TEST_FILE_OFF, TEST_FILE_RULES, TS_FILES,
  TS_UNUSED_VARS, TYPE_CHECKED_OPTIONS, TYPE_CHECKED_RULES, TYPESCRIPT_ESLINT_RULES, prefixed, prefixedOptions,
} from "./configs.ts";

const recommended: Linter.Config[] = [
  {
    name: `${PLUGIN_PREFIX}/recommended`,
    files: ALL_FILES,
    plugins: { [PLUGIN_PREFIX]: plugin as unknown as ESLint.Plugin, "@typescript-eslint": tseslint.plugin as unknown as ESLint.Plugin },
    // JavaScript keeps ESLint's own parser, which reads sloppy-mode code in a CommonJS file as ESLint's defaults say; JSX is on for every file.
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    rules: { ...BUILT_IN_RULES, ...JS_UNUSED_VARS, ...TYPESCRIPT_ESLINT_RULES, ...prefixed(SYNTAX_RULES) } as unknown as Linter.RulesRecord,
  },
  {
    name: `${PLUGIN_PREFIX}/recommended/typescript`,
    files: TS_FILES,
    languageOptions: { parser: tseslint.parser as Linter.Parser },
    rules: TS_UNUSED_VARS as unknown as Linter.RulesRecord,
  },
  { name: `${PLUGIN_PREFIX}/recommended/tests`, files: TEST_FILES, rules: { ...TEST_FILE_OFF, ...prefixed(TEST_FILE_RULES) } },
];

const recommendedTypeChecked: Linter.Config[] = [
  ...recommended,
  {
    name: `${PLUGIN_PREFIX}/recommended-type-checked`,
    files: TS_FILES,
    languageOptions: { parserOptions: { projectService: true } },
    rules: { ...prefixed(TYPE_CHECKED_RULES), ...prefixedOptions(TYPE_CHECKED_OPTIONS) } as unknown as Linter.RulesRecord,
  },
];

const ai: Linter.Config[] = [
  {
    name: `${PLUGIN_PREFIX}/ai`,
    files: ALL_FILES,
    plugins: { [PLUGIN_PREFIX]: plugin as unknown as ESLint.Plugin },
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    rules: prefixed(AI_RULES),
  },
  { name: `${PLUGIN_PREFIX}/ai/typescript`, files: TS_FILES, languageOptions: { parser: tseslint.parser as Linter.Parser } },
  { name: `${PLUGIN_PREFIX}/ai/tests`, files: TEST_FILES, rules: AI_TEST_FILE_OFF },
];

const eslintPlugin: ESLint.Plugin & { configs: Record<"recommended" | "recommended-type-checked" | "ai", Linter.Config[]> } = {
  ...(plugin as unknown as ESLint.Plugin),
  configs: { recommended, "recommended-type-checked": recommendedTypeChecked, ai },
};

export default eslintPlugin;
