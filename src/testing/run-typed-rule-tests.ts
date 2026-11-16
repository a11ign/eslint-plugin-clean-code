/**
 * Runs a type-aware rule's cases under ESLint with typescript-eslint's project service. These rules ship only in
 * `recommended-type-checked`, which is ESLint only (ADR 0002: Oxlint's JS plugins have no type information), so there is no
 * Oxlint run here. Each case is linted as `typed-fixture/file.ts` with that directory's `tsconfig.json`.
 */
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { RuleTester, type Rule } from "eslint";
import tsParser from "@typescript-eslint/parser";

RuleTester.describe = describe;
RuleTester.it = it;

const FIXTURE_DIR = fileURLToPath(new URL("./typed-fixture/", import.meta.url));

export interface TypedCase {
  code: string;
  name?: string;
  options?: unknown[];
}

export interface TypedInvalidCase extends TypedCase {
  errors: number | Array<Record<string, unknown> | string>;
  output?: string | null;
}

export function runTypedRuleTests(ruleName: string, rule: Rule.RuleModule, cases: { valid: Array<TypedCase | string>; invalid: TypedInvalidCase[] }): void {
  const tester = typedRuleTester();
  describe(`${ruleName} under ESLint with type information`, () => {
    tester.run(ruleName, rule, {
      valid: cases.valid.map(toCase),
      invalid: cases.invalid.map((c) => ({ ...toCase(c), output: c.output ?? null })) as never,
    });
  });
}

/** A RuleTester that parses with typescript-eslint's project service, on the fixture directory's `tsconfig.json`. */
function typedRuleTester(): RuleTester {
  return new RuleTester({
    languageOptions: {
      parser: tsParser,
      parserOptions: { projectService: true, tsconfigRootDir: FIXTURE_DIR },
    },
  });
}

function toCase(testCase: TypedCase | string) {
  const typedCase = typeof testCase === "string" ? { code: testCase } : testCase;
  return { ...typedCase, filename: `${FIXTURE_DIR}file.ts` };
}

/**
 * Lints each of the `valid` cases of `rule`, named `ruleName`, with typescript-eslint's parser and no `projectService`, so
 * `parserServices.program` is `null`. A type-aware rule must then report nothing and not crash.
 */
export function runWithoutTypeInformation(ruleName: string, rule: Rule.RuleModule, valid: string[]): void {
  const tester = new RuleTester({ languageOptions: { parser: tsParser } });
  describe(`${ruleName} under ESLint without type information`, () => {
    tester.run(ruleName, rule, { valid: valid.map((code) => ({ code, filename: "file.ts" })), invalid: [] });
  });
}
