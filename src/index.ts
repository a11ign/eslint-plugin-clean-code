/**
 * The ESLint plugin: its rules and its two flat configs.
 *
 * - `recommended`: every custom rule that needs only syntax, and the built-in rules the catalog maps to the book, for
 *   JavaScript, TypeScript, JSX and TSX. TypeScript files are parsed with typescript-eslint's parser, JavaScript with ESLint's own.
 * - `recommended-type-checked`: `recommended`, plus the rules that need type information, with typescript-eslint's
 *   `projectService` turned on.
 * - `ai`: opt-in and standalone, the five `ai-` rules for the habits of AI-generated code (ADR 0001), with the same parsers as
 *   `recommended`. Stack it after `recommended`, or use it alone.
 * - `node`: opt-in, the four `node-` rules for Node's event loop and error model (ADR 0004 of A11-415). Stack it after
 *   `recommended`. It needs nothing that `recommended` does not.
 * - `node-extended`: opt-in, `eslint-plugin-n`'s rules that `docs/catalog-node.md` grounds, listed one by one. Stack it after
 *   `node`. `eslint-plugin-n` is an optional peer dependency, loaded only when this config is read, so a project that does not
 *   use `node-extended` does not need it installed; without it, linting with `node-extended` fails with a message to install it.
 */
import { createRequire } from "node:module";
import type { ESLint, Linter, Rule } from "eslint";
import tseslint from "typescript-eslint";
import plugin from "./plugin.ts";
import {
  AI_RULES, AI_TEST_FILE_OFF, ALL_FILES, BUILT_IN_RULES, JS_UNUSED_VARS, NODE_EXTENDED_RULES, NODE_RULES, PLUGIN_PREFIX, SYNTAX_RULES, TEST_FILES, TEST_FILE_OFF, TEST_FILE_RULES, TS_FILES,
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

const node: Linter.Config[] = [
  {
    name: `${PLUGIN_PREFIX}/node`,
    files: ALL_FILES,
    plugins: { [PLUGIN_PREFIX]: plugin as unknown as ESLint.Plugin },
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    rules: prefixed(NODE_RULES),
  },
  { name: `${PLUGIN_PREFIX}/node/typescript`, files: TS_FILES, languageOptions: { parser: tseslint.parser as Linter.Parser } },
];

const MISSING_ESLINT_PLUGIN_N = "The node-extended config needs eslint-plugin-n: npm install --save-dev eslint-plugin-n";

/**
 * Stands in for `eslint-plugin-n` when it is not installed. Reading the config, or listing every config, still works; linting
 * with `node-extended` fails, at its first file, with a message that says what to install.
 */
function missingEslintPluginN(cause: unknown): ESLint.Plugin {
  const missing: Rule.RuleModule = {
    meta: { schema: false },
    create() {
      throw new Error(MISSING_ESLINT_PLUGIN_N, { cause });
    },
  };
  return { meta: { name: "eslint-plugin-n (not installed)" }, rules: { "handle-callback-err": missing } };
}

/** The optional peer `eslint-plugin-n`, required when `node-extended` is first read. */
function loadEslintPluginN(): ESLint.Plugin {
  try {
    const loaded = createRequire(import.meta.url)("eslint-plugin-n") as ESLint.Plugin & { default?: ESLint.Plugin };
    return loaded.default ?? loaded;
  } catch (error) {
    return missingEslintPluginN(error);
  }
}

let nodeExtended: Linter.Config[] | undefined;

/** `node-extended`, built once, when it is first read. */
function nodeExtendedConfig(): Linter.Config[] {
  nodeExtended ??= [
    {
      name: `${PLUGIN_PREFIX}/node-extended`,
      files: ALL_FILES,
      plugins: { n: loadEslintPluginN() },
      rules: NODE_EXTENDED_RULES as unknown as Linter.RulesRecord,
    },
  ];
  return nodeExtended;
}

type ConfigName = "recommended" | "recommended-type-checked" | "ai" | "node" | "node-extended";

const configs: Record<ConfigName, Linter.Config[]> = {
  recommended,
  "recommended-type-checked": recommendedTypeChecked,
  ai,
  node,
  /** A getter, so `eslint-plugin-n` is loaded only by a project that reads `node-extended`. */
  get "node-extended"() {
    return nodeExtendedConfig();
  },
};

const eslintPlugin: ESLint.Plugin & { configs: Record<ConfigName, Linter.Config[]> } = {
  ...(plugin as unknown as ESLint.Plugin),
  configs,
};

export default eslintPlugin;
