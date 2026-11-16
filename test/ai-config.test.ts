/**
 * The ticket's acceptance for the opt-in `ai` config, end to end: the README's `ai` setup blocks, as written, under ESLint
 * and under Oxlint, on the files in `test/fixtures/ai/`, which hold one case for each scenario. Each linter loads the BUILT
 * package by its name, the way an installed project does.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ESLint } from "eslint";
import { ROOT, assertNoParseErrors, onFixtures, readmeBlock, runEslintWithConfigFile, runOxlint, type Report } from "./support.ts";

const FIXTURES = join(ROOT, "test", "fixtures", "ai");
const AI_PREFIX = "clean-code-book/ai-";

/**
 * What the `ai` config reports in each fixture file, once per report. `documented.ts` (a doc comment, a directive and a
 * licence header) and `invoices.test.ts` (a stub and a placeholder in a test file) get nothing.
 */
const EXPECTED: Record<string, string[]> = {
  "src/catch.ts": ["clean-code-book/ai-no-ceremonial-catch", "clean-code-book/ai-no-ceremonial-catch"],
  "src/emoji.tsx": ["clean-code-book/ai-no-emoji", "clean-code-book/ai-no-emoji"],
  "src/invoices.ts": ["clean-code-book/ai-no-placeholder-implementation"],
  "src/loop.ts": ["clean-code-book/ai-no-inline-comments"],
  "src/values.ts": ["clean-code-book/ai-no-placeholder-values"],
};

/** The `ai-` rules each file in `reports` got, sorted, leaving out the files that got none. */
function aiReports(reports: Report[]): Record<string, string[]> {
  const byFile = reports.map((report) => [report.file, report.rules.filter((rule) => rule.startsWith(AI_PREFIX)).sort()] as const);
  return Object.fromEntries(byFile.filter(([, rules]) => rules.length > 0).sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * `src/invoices.test.ts`: the stub of `src/invoices.ts`, and a placeholder value, in a test file. It is written here rather
 * than kept in the fixtures, where rstest would take it for a test suite.
 */
const TEST_FILE = 'export function exportInvoices() { throw new Error("Not implemented"); }\n\nexport const apiKey = "YOUR_API_KEY";\n';

/** Runs `lint` on a fresh copy of the fixtures, with `src/invoices.test.ts` added and `eslint.config.js` set to `eslintConfig` when one is given. */
async function onAiFixtures<T>(lint: (dir: string) => Promise<T> | T, eslintConfig?: string): Promise<T> {
  return onFixtures(FIXTURES, lint, { eslintConfig, prepare: addTestFile });
}

function addTestFile(dir: string): void {
  writeFileSync(join(dir, "src", "invoices.test.ts"), TEST_FILE);
}

describe("the ai config", () => {
  it("ESLint: the README's ai setup reports each scenario's rule, and nothing in the doc-comment, directive, licence or test files", async () => {
    const reports = await onAiFixtures(runEslintWithConfigFile, readmeBlock("eslint-ai"));
    assertNoParseErrors(reports);
    assert.deepEqual(aiReports(reports), EXPECTED);
  });

  it("Oxlint: the README's ai setup reports the same five rules as ESLint, in the same files", async () => {
    const reports = await onAiFixtures((dir) => runOxlint(dir, [], readmeBlock("oxlint-ai")));
    assertNoParseErrors(reports);
    assert.deepEqual(aiReports(reports), EXPECTED);
  });

  it("ESLint: the comment report points to a name, a function, a JSDoc or a doc file, and --fix leaves the comment in place", async () => {
    await onAiFixtures(async (dir) => {
      const eslint = new ESLint({ cwd: dir, fix: true });
      const [result] = await eslint.lintFiles(["src/loop.ts"]);
      await ESLint.outputFixes([result]);
      const comment = result.messages.find((message) => message.ruleId === "clean-code-book/ai-no-inline-comments");
      assert.ok(comment, "ai-no-inline-comments did not report");
      assert.equal(comment.severity, 2);
      assert.equal(comment.line, 2);
      assert.match(comment.message, /"Loop through the users"/);
      assert.match(comment.message, /clearer name.*extracted function.*JSDoc.*doc file/);
      assert.match(readFileSync(join(dir, "src", "loop.ts"), "utf8"), /\n {2}\/\/ Loop through the users\n/);
    }, readmeBlock("eslint-ai"));
  });

  it("ESLint and Oxlint: a project on recommended alone gets no ai- report", async () => {
    const eslintReports = await onAiFixtures(runEslintWithConfigFile, readmeBlock("eslint"));
    const oxlintReports = await onAiFixtures((dir) => runOxlint(dir, [], readmeBlock("oxlint")));
    assert.deepEqual(aiReports(eslintReports), {});
    assert.deepEqual(aiReports(oxlintReports), {});
    assert.ok(eslintReports.some((report) => report.rules.length > 0), "recommended reported nothing, so this check could not fail");
  });
});
