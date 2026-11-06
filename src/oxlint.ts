/**
 * The Oxlint config: the same rules as ESLint's `recommended`, under Oxlint's names, with this plugin loaded through
 * `jsPlugins`. Use it from `oxlint.config.ts` with `extends: [recommended]`. Rules that need type information are not here:
 * Oxlint's JS plugins have no type information (ADR 0002). `ai` is the opt-in config of the same name in ESLint, used with
 * `extends: [ai]` or `extends: [recommended, ai]`.
 */
import { AI_RULES, AI_TEST_FILE_OFF, BUILT_IN_RULES, PLUGIN_PREFIX, SYNTAX_RULES, TEST_FILES, TEST_FILE_OFF, TEST_FILE_RULES, prefixed } from "./configs.ts";
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

export default { recommended, ai };
