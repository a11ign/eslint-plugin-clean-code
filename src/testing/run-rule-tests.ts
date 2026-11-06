/**
 * Runs one rule's test cases under ESLint's RuleTester AND Oxlint's (ADR 0002: CI runs every rule's tests under both),
 * and adds the catalog's three checks for every fix ("How fixes stay safe", rule 5):
 *
 * 1. the output text (RuleTester's own `output`),
 * 2. the fixed output no longer reports, which is also the check that a second `--fix` changes nothing
 *    (a case whose fix is partial names the reports that remain in `outputErrors`),
 * 3. the code before and after, run on the same inputs, gives the same results (`behaviour`).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";
import { RuleTester as EslintRuleTester, type Rule } from "eslint";
import { RuleTester as OxlintRuleTester } from "oxlint/plugins-dev";
import tsParser from "@typescript-eslint/parser";

type Errors = number | Array<string | RegExp | Record<string, unknown>>;

interface CaseBase {
  code: string;
  name?: string;
  /** Defaults to `file.ts`. Use `file.tsx`, `file.js` or `file.jsx` for other languages, and a `*.test.ts` name for test-file rules. */
  filename?: string;
  options?: unknown[];
  sourceType?: "module" | "script" | "commonjs";
  /** Run under ESLint only. The reason is required, so a gap between the linters is never silent. */
  eslintOnlyBecause?: string;
}

export type ValidCase = CaseBase | string;

export interface InvalidCase extends CaseBase {
  errors: Errors;
  /** The fixed code, or `null` when the rule reports without a fix. */
  output: string | null;
  /** For a partial fix: the reports the rule still makes on `output`. When left out, `output` must report nothing. */
  outputErrors?: Errors;
  /**
   * An expression evaluated after the code and after the output, each in a fresh context; both must give the same
   * JSON value (or throw the same message). The code may not import anything. `export` keywords are dropped first.
   */
  behaviour?: string | string[];
}

export interface RuleCases {
  valid: ValidCase[];
  invalid: InvalidCase[];
}

const DEFAULT_FILENAME = "file.ts";

EslintRuleTester.describe = describe;
EslintRuleTester.it = it;
(EslintRuleTester as unknown as { itOnly: unknown }).itOnly = it.only;
OxlintRuleTester.describe = describe;
OxlintRuleTester.it = it as never;

function languageOptions(testCase: CaseBase) {
  return {
    parser: tsParser,
    sourceType: testCase.sourceType ?? "module",
    parserOptions: { ecmaFeatures: { jsx: /\.[jt]sx$/.test(testCase.filename ?? DEFAULT_FILENAME) } },
  };
}

function normalise(testCase: ValidCase): CaseBase {
  return typeof testCase === "string" ? { code: testCase } : testCase;
}

function eslintCase(testCase: CaseBase): Record<string, unknown> {
  const { code, name, options } = testCase;
  return {
    code,
    ...(name ? { name } : {}),
    ...(options ? { options } : {}),
    filename: testCase.filename ?? DEFAULT_FILENAME,
    languageOptions: languageOptions(testCase),
  };
}

function oxlintCase(testCase: CaseBase): Record<string, unknown> {
  const { code, name, options } = testCase;
  return {
    code,
    ...(name ? { name } : {}),
    ...(options ? { options } : {}),
    filename: testCase.filename ?? DEFAULT_FILENAME,
    languageOptions: { sourceType: testCase.sourceType ?? "module" },
  };
}

function invalidFor(make: (c: CaseBase) => Record<string, unknown>, testCase: InvalidCase) {
  return { ...make(testCase), errors: testCase.errors, output: testCase.output };
}

/** The cases each fix adds: its output reports nothing (or only `outputErrors`, with no further fix). */
function fixedOutputCases(invalid: InvalidCase[]): { valid: CaseBase[]; invalid: InvalidCase[] } {
  const valid: CaseBase[] = [];
  const stillInvalid: InvalidCase[] = [];
  for (const testCase of invalid) {
    if (testCase.output === null) continue;
    const fixed = { ...testCase, code: testCase.output, name: `fixed output of: ${testCase.name ?? testCase.code}` };
    if (testCase.outputErrors === undefined) valid.push(fixed);
    else stillInvalid.push({ ...fixed, errors: testCase.outputErrors, output: null, outputErrors: undefined });
  }
  return { valid, invalid: stillInvalid };
}

function runnable(code: string, filename: string): string {
  const js = /\.tsx?$/.test(filename) ? stripTypeScriptTypes(code, { mode: "strip" }) : code;
  return js.replace(/^(\s*)export\s+(default\s+)?/gm, "$1");
}

function evaluate(code: string, expression: string): string {
  try {
    const value = vm.runInNewContext(`${code}\n;(${expression})`, {}, { timeout: 1000 });
    return `value ${JSON.stringify(value)}`;
  } catch (error) {
    return `throws ${(error as Error).message}`;
  }
}

function behaviourTests(ruleName: string, invalid: InvalidCase[]): void {
  const withBehaviour = invalid.filter((testCase) => testCase.behaviour && testCase.output !== null);
  if (withBehaviour.length === 0) return;
  describe(`${ruleName}: a fix keeps behaviour`, () => {
    for (const testCase of withBehaviour) {
      it(testCase.name ?? testCase.code, () => {
        const filename = testCase.filename ?? DEFAULT_FILENAME;
        for (const expression of [testCase.behaviour].flat() as string[]) {
          const before = evaluate(runnable(testCase.code, filename), expression);
          const after = evaluate(runnable(testCase.output as string, filename), expression);
          assert.equal(after, before, `${expression} gave a different result after the fix`);
          assert.doesNotMatch(before, /is not defined/, `${expression} could not run on the code before the fix`);
        }
      });
    }
  });
}

function both(cases: { valid: CaseBase[]; invalid: InvalidCase[] }) {
  const keep = (c: CaseBase) => !c.eslintOnlyBecause;
  return {
    eslint: { valid: cases.valid.map(eslintCase), invalid: cases.invalid.map((c) => invalidFor(eslintCase, c)) },
    oxlint: { valid: cases.valid.filter(keep).map(oxlintCase), invalid: cases.invalid.filter(keep).map((c) => invalidFor(oxlintCase, c)) },
  };
}

/** Runs `cases` for the rule under both linters, with the fix checks above. */
export function runRuleTests(ruleName: string, rule: Rule.RuleModule, cases: RuleCases): void {
  const extra = fixedOutputCases(cases.invalid);
  const all = { valid: [...cases.valid.map(normalise), ...extra.valid], invalid: [...cases.invalid, ...extra.invalid] };
  const { eslint, oxlint } = both(all);
  describe(`${ruleName} under ESLint`, () => {
    new EslintRuleTester().run(ruleName, rule, eslint as never);
  });
  describe(`${ruleName} under Oxlint`, () => {
    new OxlintRuleTester({ eslintCompat: true }).run(ruleName, rule as never, oxlint as never);
  });
  behaviourTests(ruleName, cases.invalid);
}
