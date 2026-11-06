/**
 * What `recommended`, `recommended-type-checked`, `ai`, `node`, `node-extended`, `react` and `react-extended` turn on, written once
 * as data so the ESLint config and the Oxlint config are built from the same list. Every rule is `"error"` (the catalog's decision). Thresholds the book states are its values;
 * the others are the values the catalog's owner sign-off approved. A custom rule's threshold is its own default.
 */

/** The catalog entry each built-in rule comes from is in the comment beside it. */
export const BUILT_IN_RULES = {
  "max-params": ["error", { max: 3, countThis: "never" }], // FN-04: "three is usually my limit"
  "max-lines-per-function": ["error", { max: 12, skipBlankLines: true, skipComments: true }], // FN-01: "a dozen lines or less"
  "max-depth": ["error", { max: 2 }], // FN-03: "seldom be greater than one or two"
  "complexity": ["error", { max: 15 }], // FN-02: owner sign-off
  "max-lines": ["error", { max: 500 }], // FMT-01: "an upper limit of 500"
  "max-classes-per-file": ["error", { max: 1 }], // CLS-01: "a single module or class per source file"
  "no-else-return": ["error", { allowElseIf: false }], // CD-02
  "no-unneeded-ternary": "error", // CD-01
  "no-labels": "error", // FH-12
  "no-warning-comments": ["error", { terms: ["todo", "fixme"] }], // CMT-10: owner sign-off for `fixme`
  "no-param-reassign": ["error", { props: true, ignorePropertyModificationsFor: ["acc", "accumulator"] }], // FH-03
  "no-fallthrough": "error", // CLS-05
  "no-unreachable": "error", // HRM-01
  "no-empty": ["error", { allowEmptyCatch: false }], // FH-08
  "id-denylist": ["error", "l", "O", "I", "klass", "clazz"], // NAM-06, NAM-07: owner sign-off for `I`
} as const;

/** HRM-01 in JavaScript: ESLint core's `no-unused-vars` has suggestions and no fix. */
export const JS_UNUSED_VARS = { "no-unused-vars": "error" } as const;

/** HRM-01 in TypeScript: typescript-eslint's version, with its import removal under `--fix` turned off explicitly. */
export const TS_UNUSED_VARS = {
  "no-unused-vars": "off",
  "@typescript-eslint/no-unused-vars": ["error", { enableAutofixRemoval: { imports: false } }],
} as const;

/** CD-04: typescript-eslint's rule, which needs no type information and runs on JavaScript too. */
export const TYPESCRIPT_ESLINT_RULES = { "@typescript-eslint/prefer-for-of": "error" } as const;

/** Custom rules for every file, in `recommended`. */
export const SYNTAX_RULES = [
  "error-handling-is-one-thing",
  "fields-first",
  "loop-variable-in-loop",
  "max-block-statements",
  "name-length-matches-scope",
  "no-attribution-comments",
  "no-command-query-mix",
  "no-commented-out-code",
  "no-complex-condition",
  "no-encodings",
  "no-flag-argument",
  "no-getter-chains",
  "no-html-in-comments",
  "no-hybrid-class",
  "no-journal-comments",
  "no-mutable-static-state",
  "no-noise-words",
  "no-number-series-names",
  "no-overloaded-constructors",
  "no-position-markers",
  "no-protected-fields",
  "no-pure-delegator",
  "no-redundant-comments",
  "no-side-effects-in-predicates",
  "no-trivial-accessors",
  "one-switch-per-type",
  "return-boolean-directly",
  "stepdown-order",
] as const;

/** Custom rules for test files only (TST-04, TST-05, TST-07), in `recommended`. */
export const TEST_FILE_RULES = ["no-disabled-tests", "no-shared-test-state", "test-asserts"] as const;

/** Custom rules that need type information, in `recommended-type-checked` only. */
export const TYPE_CHECKED_RULES = [
  "law-of-demeter",
  "no-concrete-inheritance",
  "no-container-in-name",
  "no-subtype-check",
  "predicate-returns-boolean",
] as const;

/** FH-04's method-call half: the same rule, resolving `obj.method()` through types. */
export const TYPE_CHECKED_OPTIONS = { "no-command-query-mix": ["error", { checkMethodCalls: true }] } as const;

/**
 * The opt-in `ai` config (ADR 0001): rules for the habits of AI-generated code, from `docs/catalog-ai.md`, not from the book.
 * It stands alone, so it can be used with `recommended` or without it.
 */
export const AI_RULES = [
  "ai-no-ceremonial-catch",
  "ai-no-emoji",
  "ai-no-inline-comments",
  "ai-no-placeholder-implementation",
  "ai-no-placeholder-values",
] as const;

/** A stub body and a placeholder value are what a test is allowed to use (AI-03, AI-05). */
export const AI_TEST_FILE_OFF = {
  "clean-code-book/ai-no-placeholder-implementation": "off",
  "clean-code-book/ai-no-placeholder-values": "off",
} as const;

/**
 * The opt-in `node` config (ADR 0004 of A11-415): rules for Node's event loop and error model, from `docs/catalog-node.md`.
 * It stacks on `recommended`: `[...recommended, ...node]`. It adds no peer dependency.
 */
export const NODE_RULES = [
  "node-exit-after-fatal-error",
  "node-no-error-message-matching",
  "node-no-recursive-next-tick",
  "node-no-sync-in-handler",
] as const;

/**
 * NODE-08: the callback-error name pattern, owner sign-off. `eslint-plugin-n`'s default matches only `err`; this adds `error`.
 * The same value is the ESLint and the Oxlint setting.
 */
export const CALLBACK_ERROR_PATTERN = "^(err|error)$";

/**
 * The opt-in `node-extended` config: the `third-party` entries of `docs/catalog-node.md`, listed one by one. It stacks on
 * `node`. It leaves out `n/no-process-exit`, which would report the exit NODE-04 asks for, and `n/no-sync`, which reports the
 * startup reads NODE-01 leaves alone, and it uses none of `eslint-plugin-n`'s presets.
 */
export const NODE_EXTENDED_RULES = { "n/handle-callback-err": ["error", CALLBACK_ERROR_PATTERN] } as const;

/**
 * The opt-in `react` config (ADR 0004 of A11-415): rules for React components and hooks, from `docs/catalog-react.md`. It stacks
 * on `recommended`: `[...recommended, ...react]`, applies to `REACT_FILES` only, and adds no peer dependency. It overrides no
 * rule of `recommended`: components and custom hooks keep FN-01's 12 lines (the catalog's "Conflicts", item 1).
 */
export const REACT_RULES = ["react-no-state-mutation", "react-no-untyped-empty-state"] as const;

/**
 * The opt-in `react-extended` config: the `third-party` entries of `docs/catalog-react.md`, listed one by one, each `"error"`,
 * by their names in `eslint-plugin-react-hooks` (RCT-01, RCT-02, RCT-03) and `eslint-plugin-react` (RCT-04). It stacks on
 * `react` and uses neither plugin's preset, whose `exhaustive-deps` is a warning. Oxlint's native `react` plugin has every one of
 * them under the same rule name, as `react/<name>`.
 */
export const REACT_HOOKS_RULES = ["rules-of-hooks", "exhaustive-deps"] as const;
export const REACT_JSX_RULES = ["jsx-key", "no-array-index-key"] as const;

/** `rules` under `plugin`'s name, each `"error"`: `pluginRules("react", ["jsx-key"])` gives `{ "react/jsx-key": "error" }`. */
export function pluginRules(plugin: string, rules: readonly string[]): Record<string, "error"> {
  return Object.fromEntries(rules.map((name) => [`${plugin}/${name}`, "error"]));
}

/** The files `react` and the `react/` rules of `react-extended` apply to. */
export const REACT_FILES = ["**/*.{jsx,tsx}"];
/** The files the hooks rules apply to: `REACT_FILES`, and a custom hook in a `.js` or `.ts` file such as `useChecked.ts`. */
export const REACT_HOOK_FILES = [...REACT_FILES, "**/use*.{js,ts}"];
/** The TypeScript files among them, which ESLint parses with typescript-eslint's parser. */
export const REACT_TS_FILES = ["**/*.tsx"];
export const REACT_HOOK_TS_FILES = [...REACT_TS_FILES, "**/use*.ts"];

const SOURCE_EXTENSIONS = "{js,mjs,cjs,jsx,ts,mts,cts,tsx}";
export const ALL_FILES = [`**/*.${SOURCE_EXTENSIONS}`];
export const TS_FILES = ["**/*.{ts,mts,cts,tsx}"];
/** TST-01: the files the test rules apply to, and where `max-lines-per-function` is off. */
export const TEST_FILES = [`**/*.{test,spec}.${SOURCE_EXTENSIONS}`, `**/__tests__/**/*.${SOURCE_EXTENSIONS}`];

/** TST-01's one exception: a `describe` callback is a group of tests, not a function in the book's sense. */
export const TEST_FILE_OFF = { "max-lines-per-function": "off" } as const;

export const PLUGIN_PREFIX = "clean-code-book";

export function prefixed(names: readonly string[]): Record<string, "error"> {
  return pluginRules(PLUGIN_PREFIX, names);
}

export function prefixedOptions(rules: Record<string, readonly unknown[]>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(rules).map(([name, setting]) => [`${PLUGIN_PREFIX}/${name}`, setting]));
}
