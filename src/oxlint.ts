/**
 * The Oxlint config: the same rules as ESLint's `recommended`, under Oxlint's names, with this plugin loaded through
 * `jsPlugins`. Use it from `oxlint.config.ts` with `extends: [recommended]`. Rules that need type information are not here:
 * Oxlint's JS plugins have no type information (ADR 0002). `ai` is the opt-in config of the same name in ESLint, used with
 * `extends: [ai]` or `extends: [recommended, ai]`. `typescript` and `typescriptExtended` are the opt-in configs `typescript` and
 * `typescript-extended`, used with `extends: [recommended, typescript, typescriptExtended]`. `typescriptExtended` uses Oxlint's
 * native `typescript` and `promise` plugins and loads no JS plugin. `typescript-extended-type-checked` has no Oxlint export, for
 * the same reason as `recommended-type-checked`. `node` and `nodeExtended` are the opt-in configs `node` and `node-extended`,
 * used with `extends: [recommended, node, nodeExtended]`. `nodeExtended` uses Oxlint's native `node` plugin and loads no JS plugin.
 * `react` and `reactExtended` are the opt-in configs `react` and `react-extended`, used with
 * `extends: [recommended, react, reactExtended]`, on the same files as in ESLint. `reactExtended` uses Oxlint's native `react`
 * plugin, which has the rules of both `eslint-plugin-react-hooks` and `eslint-plugin-react`, and loads no JS plugin.
 */
import {
  AI_RULES, AI_TEST_FILE_OFF, BUILT_IN_RULES, CALLBACK_ERROR_PATTERN, NODE_RULES, PLUGIN_PREFIX, PROMISE_RULES, REACT_FILES, REACT_HOOKS_RULES, REACT_HOOK_FILES,
  REACT_JSX_RULES, REACT_RULES, SYNTAX_RULES, TEST_FILES, TEST_FILE_OFF, TEST_FILE_RULES, TS_FILES, TYPESCRIPT_BUILT_IN_RULES, TYPESCRIPT_EXTENDED_RULES, TYPESCRIPT_RULES,
  pluginRules, pluginSettings, prefixed,
} from "./configs.ts";
import { PACKAGE_NAME } from "./lib/define-rule.ts";

/**
 * HRM-01 under Oxlint: its `no-unused-vars` covers JavaScript and TypeScript. Its fixes are suggestions, which
 * `--fix-suggestions` applies, and in a check on 2026-11-06 that rewrote `import type { A, B }` and deleted a value import
 * with its side effects. Both fixes are turned off.
 */
const OXLINT_UNUSED_VARS = { "no-unused-vars": ["error", { fix: { imports: "off", variables: "off" } }] };

export const recommended = {
  jsPlugins: [{ name: PLUGIN_PREFIX, specifier: `${PACKAGE_NAME}/plugin` }],
  rules: {
    ...BUILT_IN_RULES,
    ...OXLINT_UNUSED_VARS,
    "typescript/prefer-for-of": "error",
    ...prefixed(SYNTAX_RULES),
  },
  overrides: [{ files: TEST_FILES, rules: { ...TEST_FILE_OFF, ...prefixed(TEST_FILE_RULES) } }],
};

export const ai = {
  jsPlugins: [{ name: PLUGIN_PREFIX, specifier: `${PACKAGE_NAME}/plugin` }],
  rules: prefixed(AI_RULES),
  overrides: [{ files: TEST_FILES, rules: AI_TEST_FILE_OFF }],
};

export const typescript = {
  jsPlugins: [{ name: PLUGIN_PREFIX, specifier: `${PACKAGE_NAME}/plugin` }],
  rules: { ...TYPESCRIPT_BUILT_IN_RULES, ...prefixed(TYPESCRIPT_RULES) },
};

/**
 * TS-01, TS-02, TS-03 and TS-13 under Oxlint's native `typescript` plugin, as `typescript/<name>` with the same options, on
 * TypeScript files; TS-11 under its native `promise` plugin, on every file.
 */
export const typescriptExtended = {
  plugins: ["typescript", "promise"],
  rules: pluginRules("promise", PROMISE_RULES),
  overrides: [{ files: TS_FILES, rules: pluginSettings("typescript", TYPESCRIPT_EXTENDED_RULES) }],
};

export const node = {
  jsPlugins: [{ name: PLUGIN_PREFIX, specifier: `${PACKAGE_NAME}/plugin` }],
  rules: prefixed(NODE_RULES),
};

/** NODE-08 under Oxlint's native `node` plugin: `n/handle-callback-err`, as `node/handle-callback-err`, with the same pattern. */
export const nodeExtended = {
  plugins: ["node"],
  rules: { "node/handle-callback-err": ["error", CALLBACK_ERROR_PATTERN] },
};

export const react = {
  jsPlugins: [{ name: PLUGIN_PREFIX, specifier: `${PACKAGE_NAME}/plugin` }],
  overrides: [{ files: REACT_FILES, rules: prefixed(REACT_RULES) }],
};

/** RCT-01 to RCT-04 under Oxlint's native `react` plugin, where the hooks rules are `react/rules-of-hooks` and `react/exhaustive-deps`. */
export const reactExtended = {
  overrides: [
    { files: REACT_HOOK_FILES, plugins: ["react"], rules: pluginRules("react", REACT_HOOKS_RULES) },
    { files: REACT_FILES, plugins: ["react"], rules: pluginRules("react", REACT_JSX_RULES) },
  ],
};

export default { recommended, ai, typescript, "typescript-extended": typescriptExtended, node, "node-extended": nodeExtended, react, "react-extended": reactExtended };
