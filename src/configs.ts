/**
 * What `recommended` and `recommended-type-checked` turn on, written once as data so the ESLint config and the Oxlint config
 * are built from the same list. Every rule is `"error"` (the catalog's decision). Thresholds the book states are its values;
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

const SOURCE_EXTENSIONS = "{js,mjs,cjs,jsx,ts,mts,cts,tsx}";
export const ALL_FILES = [`**/*.${SOURCE_EXTENSIONS}`];
export const TS_FILES = ["**/*.{ts,mts,cts,tsx}"];
/** TST-01: the files the test rules apply to, and where `max-lines-per-function` is off. */
export const TEST_FILES = [`**/*.{test,spec}.${SOURCE_EXTENSIONS}`, `**/__tests__/**/*.${SOURCE_EXTENSIONS}`];

/** TST-01's one exception: a `describe` callback is a group of tests, not a function in the book's sense. */
export const TEST_FILE_OFF = { "max-lines-per-function": "off" } as const;

export const PLUGIN_PREFIX = "clean-code-book";

export function prefixed(names: readonly string[]): Record<string, "error"> {
  return Object.fromEntries(names.map((name) => [`${PLUGIN_PREFIX}/${name}`, "error"]));
}

export function prefixedOptions(rules: Record<string, readonly unknown[]>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(rules).map(([name, setting]) => [`${PLUGIN_PREFIX}/${name}`, setting]));
}
