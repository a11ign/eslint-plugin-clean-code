/**
 * The opt-in `jsdoc` config, end to end: the README's setup blocks, as written, under ESLint and under Oxlint, on the files in
 * `test/fixtures/jsdoc/`. `src/doc.ts` holds one case for each rule, `src/plain.js` a `{type}` that JavaScript needs, and
 * `src/clean.ts` a well-formed doc comment. Each linter loads the BUILT package by its name, the way an installed project does.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { ROOT, assertNoParseErrors, onFixtures, readmeBlock, relatedReports, runEslintWithConfigFile, runOxlint, type Report } from "./support.ts";

const FIXTURES = join(ROOT, "test", "fixtures", "jsdoc");

/** Under ESLint every rule reports `src/doc.ts`; `no-types` leaves the `{type}` in `src/plain.js` alone, and `src/clean.ts` gets nothing. */
const ESLINT_EXPECTED: Record<string, string[]> = {
  "src/doc.ts": ["jsdoc/check-param-names", "jsdoc/check-tag-names", "jsdoc/empty-tags", "jsdoc/no-types"],
};

/** Oxlint has no `check-param-names` or `no-types`, so it reports the misspelled tag and the content on `@async` only. */
const OXLINT_EXPECTED: Record<string, string[]> = { "src/doc.ts": ["jsdoc/check-tag-names", "jsdoc/empty-tags"] };

function jsdocReports(reports: Report[]): Record<string, string[]> {
  return relatedReports(reports, /^jsdoc\//);
}

interface WithoutPluginJsdoc {
  /** How many entries each config has, read through `Object.values`, which also reads `jsdoc`. */
  lengths: Record<string, number>;
  /** What linting a file with `recommended`, and with `jsdoc`, gave: `ok`, or the error's message. */
  recommendedLint: string;
  jsdocLint: string;
}

/**
 * Imports the built package with `eslint-plugin-jsdoc` made unresolvable, as in a project that never installed it, lists every
 * config, and lints a file with `recommended` and with `jsdoc`.
 */
function withoutEslintPluginJsdoc(): WithoutPluginJsdoc {
  const script = `
import { registerHooks } from "node:module";
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "eslint-plugin-jsdoc") throw Object.assign(new Error("Cannot find module 'eslint-plugin-jsdoc'"), { code: "MODULE_NOT_FOUND" });
    return next(specifier, context);
  },
});
const { default: cleanCode } = await import("eslint-plugin-clean-code-book");
const { Linter } = await import("eslint");
const lengths = Object.fromEntries(Object.entries(cleanCode.configs).map(([name, config]) => [name, config.length]));
function lint(config) {
  try {
    new Linter().verify("/** @param value the value */\\nexport function use(value) { return value; }\\n", config, "file.js");
    return "ok";
  } catch (error) {
    return error.message;
  }
}
const recommendedLint = lint(cleanCode.configs.recommended);
const jsdocLint = lint([...cleanCode.configs.recommended, ...cleanCode.configs.jsdoc]);
console.log(JSON.stringify({ lengths, recommendedLint, jsdocLint }));
`;
  const run = spawnSync(process.execPath, ["--input-type=module", "-e", script], { cwd: ROOT, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout);
}

describe("the jsdoc config", () => {
  it("ESLint: the README's jsdoc setup reports each malformed doc comment, but not a {type} in JavaScript or a clean comment", async () => {
    const reports = await onFixtures(FIXTURES, runEslintWithConfigFile, { eslintConfig: readmeBlock("eslint-jsdoc") });
    assertNoParseErrors(reports);
    assert.deepEqual(jsdocReports(reports), ESLINT_EXPECTED);
    assert.equal(reports.filter((report) => report.file.startsWith("src/")).length, 3, "ESLint did not lint every fixture, so this check could not fail");
  });

  it("Oxlint: the README's jsdoc setup reports the misspelled tag and the content on an empty tag natively, and loads no JS plugin for them", async () => {
    const reports = await onFixtures(FIXTURES, (dir) => runOxlint(dir, [], readmeBlock("oxlint-jsdoc")));
    assertNoParseErrors(reports);
    assert.deepEqual(jsdocReports(reports), OXLINT_EXPECTED);
  });

  it("ESLint and Oxlint: a project on recommended alone gets no jsdoc report", async () => {
    const eslintReports = await onFixtures(FIXTURES, runEslintWithConfigFile, { eslintConfig: readmeBlock("eslint") });
    const oxlintReports = await onFixtures(FIXTURES, (dir) => runOxlint(dir, [], readmeBlock("oxlint")));
    assert.deepEqual(jsdocReports(eslintReports), {});
    assert.deepEqual(jsdocReports(oxlintReports), {});
  });

  it("ESLint: without eslint-plugin-jsdoc, every config can be listed and recommended lints, and linting with jsdoc says to install it", () => {
    const result = withoutEslintPluginJsdoc();
    assert.deepEqual(Object.keys(result.lengths), [
      "recommended", "recommended-type-checked", "ai", "typescript", "typescript-extended", "typescript-extended-type-checked", "node", "node-extended", "react", "react-extended", "jsdoc",
    ]);
    assert.ok(Object.values(result.lengths).every((length) => length > 0), JSON.stringify(result.lengths));
    assert.equal(result.recommendedLint, "ok");
    assert.match(result.jsdocLint, /jsdoc config needs eslint-plugin-jsdoc: npm install --save-dev eslint-plugin-jsdoc/);
  });
});
