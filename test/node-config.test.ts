/**
 * The ticket's acceptance for the opt-in `node` and `node-extended` configs, end to end: the README's setup blocks, as written,
 * under ESLint and under Oxlint, on the files in `test/fixtures/node/`, which hold one case for each scenario. Each linter loads
 * the BUILT package by its name, the way an installed project does.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { ESLint } from "eslint";
import { ROOT, assertNoParseErrors, onFixtures, readmeBlock, relatedReports, runEslintWithConfigFile, runOxlint, type Report } from "./support.ts";

const FIXTURES = join(ROOT, "test", "fixtures", "node");

/** The rules this ticket is about: the `node-` rules, the callback-error rule under either linter, and the two `node-extended` leaves out. */
const NODE_RELATED = /^(clean-code-book\/node-|n\/|node\/)|no-process-exit|no-sync/;

/** What `recommended` and `node` report in each fixture file, once per report, under either linter. */
const NODE_EXPECTED: Record<string, string[]> = {
  "src/fatal.ts": ["clean-code-book/node-exit-after-fatal-error"],
  "src/handler.ts": ["clean-code-book/node-no-sync-in-handler"],
  "src/message.ts": ["clean-code-book/node-no-error-message-matching"],
  "src/tick.ts": ["clean-code-book/node-no-recursive-next-tick"],
};

/** `node-extended` adds the two callbacks that never check their error; the one that does is not reported. */
function extendedExpected(callbackRule: string): Record<string, string[]> {
  return { "src/callback.ts": [callbackRule, callbackRule], ...NODE_EXPECTED };
}

function nodeReports(reports: Report[]): Record<string, string[]> {
  return relatedReports(reports, NODE_RELATED);
}

/** A configuration with Oxlint's native rule at its default setting, which matches only `err`. */
const OXLINT_DEFAULT_PATTERN = 'export default { plugins: ["node"], rules: { "node/handle-callback-err": "error" } };\n';
const OXLINT_EXTENDED_ALONE = 'import { nodeExtended } from "eslint-plugin-clean-code-book/oxlint";\n\nexport default { extends: [nodeExtended] };\n';

interface WithoutPluginN {
  /** How many entries each config has, read through `Object.values`, which also reads `node-extended`. */
  lengths: Record<string, number>;
  /** What linting a file with `recommended`, and with `node-extended`, gave: `ok`, or the error's message. */
  recommendedLint: string;
  extendedLint: string;
}

/**
 * Imports the built package with `eslint-plugin-n` made unresolvable, as in a project that never installed it, lists every
 * config, and lints a file with `recommended` and with `node-extended`.
 */
function withoutEslintPluginN(): WithoutPluginN {
  const script = `
import { registerHooks } from "node:module";
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "eslint-plugin-n") throw Object.assign(new Error("Cannot find module 'eslint-plugin-n'"), { code: "MODULE_NOT_FOUND" });
    return next(specifier, context);
  },
});
const { default: cleanCode } = await import("eslint-plugin-clean-code-book");
const { Linter } = await import("eslint");
const lengths = Object.fromEntries(Object.entries(cleanCode.configs).map(([name, config]) => [name, config.length]));
function lint(config) {
  try {
    new Linter().verify("load((err, data) => use(data));", config, "file.js");
    return "ok";
  } catch (error) {
    return error.message;
  }
}
const recommendedLint = lint(cleanCode.configs.recommended);
const extendedLint = lint([...cleanCode.configs.node, ...cleanCode.configs["node-extended"]]);
console.log(JSON.stringify({ lengths, recommendedLint, extendedLint }));
`;
  const run = spawnSync(process.execPath, ["--input-type=module", "-e", script], { cwd: ROOT, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout);
}

describe("the node config", () => {
  it("ESLint: the README's node setup reports each scenario's rule, and not the top-level read or the handler that exits", async () => {
    const reports = await onFixtures(FIXTURES, runEslintWithConfigFile, readmeBlock("eslint-node"));
    assertNoParseErrors(reports);
    assert.deepEqual(nodeReports(reports), NODE_EXPECTED);
  });

  it("Oxlint: the README's node setup reports the same four rules as ESLint, in the same files", async () => {
    const reports = await onFixtures(FIXTURES, (dir) => runOxlint(dir, [], readmeBlock("oxlint-node")));
    assertNoParseErrors(reports);
    assert.deepEqual(nodeReports(reports), NODE_EXPECTED);
  });

  it("ESLint: each node- report is an error, with no fix and no suggestion", async () => {
    await onFixtures(FIXTURES, async (dir) => {
      const results = await new ESLint({ cwd: dir }).lintFiles(["src/*.ts"]);
      const messages = results.flatMap((result) => result.messages).filter((message) => message.ruleId?.startsWith("clean-code-book/node-"));
      assert.equal(messages.length, 4);
      for (const message of messages) {
        assert.equal(message.severity, 2, message.ruleId ?? "");
        assert.equal(message.fix, undefined, `${message.ruleId} has a fix`);
        assert.equal(message.suggestions, undefined, `${message.ruleId} has a suggestion`);
      }
      const matching = messages.find((message) => message.ruleId === "clean-code-book/node-no-error-message-matching");
      assert.equal(matching?.line, 7);
    }, readmeBlock("eslint-node"));
  });

  it("ESLint and Oxlint: a project on recommended alone gets no node report", async () => {
    const eslintReports = await onFixtures(FIXTURES, runEslintWithConfigFile, readmeBlock("eslint"));
    const oxlintReports = await onFixtures(FIXTURES, (dir) => runOxlint(dir, [], readmeBlock("oxlint")));
    assert.deepEqual(nodeReports(eslintReports), {});
    assert.deepEqual(nodeReports(oxlintReports), {});
    assert.equal(eslintReports.filter((report) => report.file.startsWith("src/")).length, 5, "ESLint did not lint every fixture, so this check could not fail");
  });

  it("ESLint: without eslint-plugin-n, every config can be listed and recommended lints, and linting with node-extended says to install it", () => {
    const result = withoutEslintPluginN();
    assert.deepEqual(Object.keys(result.lengths), [
      "recommended", "recommended-type-checked", "ai", "typescript", "typescript-extended", "typescript-extended-type-checked", "node", "node-extended", "react", "react-extended",
    ]);
    assert.ok(Object.values(result.lengths).every((length) => length > 0), JSON.stringify(result.lengths));
    assert.equal(result.recommendedLint, "ok");
    assert.match(result.extendedLint, /node-extended config needs eslint-plugin-n: npm install --save-dev eslint-plugin-n/);
  });
});

describe("the node-extended config", () => {
  it("ESLint: n/handle-callback-err reports the callbacks that never check err or error, and no-process-exit and n/no-sync stay off", async () => {
    const reports = await onFixtures(FIXTURES, runEslintWithConfigFile, readmeBlock("eslint-node-extended"));
    assertNoParseErrors(reports);
    assert.deepEqual(nodeReports(reports), extendedExpected("n/handle-callback-err"));
  });

  it("Oxlint: node/handle-callback-err reports the same callbacks natively, and no-process-exit and no-sync stay off", async () => {
    const reports = await onFixtures(FIXTURES, (dir) => runOxlint(dir, [], readmeBlock("oxlint-node-extended")));
    assertNoParseErrors(reports);
    assert.deepEqual(nodeReports(reports), extendedExpected("node/handle-callback-err"));
  });

  it("Oxlint: nodeExtended alone loads no JS plugin, and its ^(err|error)$ pattern is what reports the callback named error", async () => {
    const alone = await onFixtures(FIXTURES, (dir) => runOxlint(dir, [], OXLINT_EXTENDED_ALONE));
    const byDefault = await onFixtures(FIXTURES, (dir) => runOxlint(dir, [], OXLINT_DEFAULT_PATTERN));
    assert.deepEqual(nodeReports(alone), { "src/callback.ts": ["node/handle-callback-err", "node/handle-callback-err"] });
    assert.deepEqual(nodeReports(byDefault), { "src/callback.ts": ["node/handle-callback-err"] });
    assert.deepEqual(alone.flatMap((report) => report.rules).filter((rule) => rule.startsWith("clean-code-book/")), []);
  });
});
