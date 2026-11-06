/**
 * The ticket's acceptance for the opt-in `typescript`, `typescript-extended` and `typescript-extended-type-checked` configs, end
 * to end: the README's setup blocks, as written, under ESLint and under Oxlint, on the files in `test/fixtures/typescript/`, which
 * hold one case for each scenario. Each linter loads the BUILT package by its name, the way an installed project does.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { ESLint } from "eslint";
import { ROOT, assertNoParseErrors, onFixtures, readmeBlock, relatedReports, runEslintWithConfigFile, runOxlint, type Report } from "./support.ts";

const FIXTURES = join(ROOT, "test", "fixtures", "typescript");

/**
 * The rules this ticket is about: the `ts-` rules, `eqeqeq`, the `-extended` configs' rules (under the same names in either
 * linter's report), and HRM-01's unused-variable rules, which `typescript` leaves as they are.
 */
const TYPESCRIPT_RELATED = /^(clean-code-book\/ts-|eqeqeq$|@typescript-eslint\/|promise\/|no-unused-vars$)/;

/** What `recommended` and `typescript` report in each fixture file, under either linter, with HRM-01's rule by its name there. */
function typescriptExpected(unusedVars: string): Record<string, string[]> {
  return {
    "src/account.ts": ["clean-code-book/ts-no-definite-assignment-assertion"],
    "src/compare.js": ["eqeqeq"],
    "src/express.ts": ["clean-code-book/ts-no-module-augmentation"],
    "src/handler.ts": [unusedVars],
    "src/legacy.ts": ["clean-code-book/ts-no-amd-dependency"],
  };
}

/** `typescript-extended` adds the type assertion, the `lib` directive, and the `.then()` with a rejection callback in a `.js` file. */
function extendedExpected(unusedVars: string): Record<string, string[]> {
  return {
    ...typescriptExpected(unusedVars),
    "src/assertion.ts": ["@typescript-eslint/consistent-type-assertions"],
    "src/dom.ts": ["@typescript-eslint/triple-slash-reference"],
    "src/fetch.js": ["promise/prefer-catch"],
  };
}

const ESLINT_UNUSED_VARS = "@typescript-eslint/no-unused-vars";
const OXLINT_UNUSED_VARS = "no-unused-vars";

function typescriptReports(reports: Report[]): Record<string, string[]> {
  return relatedReports(reports, TYPESCRIPT_RELATED);
}

const ALL_CONFIGS = [
  "recommended",
  "recommended-type-checked",
  "ai",
  "typescript",
  "typescript-extended",
  "typescript-extended-type-checked",
  "node",
  "node-extended",
  "react",
  "react-extended",
];

const OXLINT_EXTENDED_ALONE = 'import { typescriptExtended } from "eslint-plugin-clean-code-book/oxlint";\n\nexport default { extends: [typescriptExtended] };\n';

interface WithoutOptionalPlugins {
  lengths: Record<string, number>;
  typescriptLint: string;
  extendedLint: string;
}

/**
 * Imports the built package with every optional peer plugin made unresolvable, as in a project that installed only the plugin,
 * ESLint and typescript-eslint. Lists every config, and lints a file with `recommended` and `typescript`, and with
 * `typescript-extended`.
 */
function withoutOptionalPlugins(): WithoutOptionalPlugins {
  const script = `
import { registerHooks } from "node:module";
const OPTIONAL = new Set(["eslint-plugin-promise", "eslint-plugin-n", "eslint-plugin-react", "eslint-plugin-react-hooks"]);
registerHooks({
  resolve(specifier, context, next) {
    if (OPTIONAL.has(specifier)) throw Object.assign(new Error("Cannot find module '" + specifier + "'"), { code: "MODULE_NOT_FOUND" });
    return next(specifier, context);
  },
});
const { default: cleanCode } = await import("eslint-plugin-clean-code-book");
const { Linter } = await import("eslint");
const lengths = Object.fromEntries(Object.entries(cleanCode.configs).map(([name, config]) => [name, config.length]));
function lint(config) {
  try {
    const messages = new Linter().verify("export const same = (a: number, b: number) => a == b;", config, "file.ts");
    return messages.map((message) => message.ruleId).join(",");
  } catch (error) {
    return error.message;
  }
}
const typescriptLint = lint([...cleanCode.configs.recommended, ...cleanCode.configs.typescript]);
const extendedLint = lint([...cleanCode.configs.typescript, ...cleanCode.configs["typescript-extended"]]);
console.log(JSON.stringify({ lengths, typescriptLint, extendedLint }));
`;
  const run = spawnSync(process.execPath, ["--input-type=module", "-e", script], { cwd: ROOT, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout);
}

describe("the typescript config", () => {
  it("ESLint: the README's typescript setup reports the definite assignment, the amd-dependency, the augmentation and == null", async () => {
    const reports = await onFixtures(FIXTURES, runEslintWithConfigFile, readmeBlock("eslint-typescript"));
    assertNoParseErrors(reports);
    assert.deepEqual(typescriptReports(reports), typescriptExpected(ESLINT_UNUSED_VARS));
    assert.ok(reports.some((report) => report.file === "src/clean.ts"), "ESLint did not lint clean.ts, so the files with no report could not fail");
  });

  it("Oxlint: the README's typescript setup reports the same rules as ESLint, in the same files", async () => {
    const reports = await onFixtures(FIXTURES, (dir) => runOxlint(dir, [], readmeBlock("oxlint-typescript")));
    assertNoParseErrors(reports);
    assert.deepEqual(typescriptReports(reports), typescriptExpected(OXLINT_UNUSED_VARS));
  });

  it("ESLint: each ts- report is an error, with no fix and no suggestion, on the line of its case", async () => {
    await onFixtures(FIXTURES, async (dir) => {
      const results = await new ESLint({ cwd: dir }).lintFiles(["src/*.{js,ts}"]);
      const messages = results.flatMap((result) => result.messages).filter((message) => message.ruleId?.startsWith("clean-code-book/ts-"));
      assert.deepEqual(messages.map((message) => [message.ruleId, message.line]).sort(), [
        ["clean-code-book/ts-no-amd-dependency", 1],
        ["clean-code-book/ts-no-definite-assignment-assertion", 2],
        ["clean-code-book/ts-no-module-augmentation", 3],
      ]);
      for (const message of messages) {
        assert.equal(message.severity, 2, message.ruleId ?? "");
        assert.equal(message.fix, undefined, `${message.ruleId} has a fix`);
        assert.equal(message.suggestions, undefined, `${message.ruleId} has a suggestion`);
      }
    }, readmeBlock("eslint-typescript"));
  });

  it("ESLint and Oxlint: a project on recommended alone gets no ts- rule and no eqeqeq, and still the unused _event", async () => {
    const eslintReports = await onFixtures(FIXTURES, runEslintWithConfigFile, readmeBlock("eslint"));
    const oxlintReports = await onFixtures(FIXTURES, (dir) => runOxlint(dir, [], readmeBlock("oxlint")));
    assert.deepEqual(typescriptReports(eslintReports), { "src/handler.ts": [ESLINT_UNUSED_VARS] });
    assert.deepEqual(typescriptReports(oxlintReports), { "src/handler.ts": [OXLINT_UNUSED_VARS] });
  });

  it("ESLint: with only this plugin and typescript-eslint installed, every config can be listed and typescript lints", () => {
    const result = withoutOptionalPlugins();
    assert.deepEqual(Object.keys(result.lengths), ALL_CONFIGS);
    assert.ok(Object.values(result.lengths).every((length) => length > 0), JSON.stringify(result.lengths));
    assert.equal(result.typescriptLint, "eqeqeq");
    assert.match(result.extendedLint, /typescript-extended config needs eslint-plugin-promise: npm install --save-dev eslint-plugin-promise/);
  });
});

describe("the typescript-extended config", () => {
  it("ESLint: typescript-eslint's rules and promise/prefer-catch report each scenario, as errors", async () => {
    const reports = await onFixtures(FIXTURES, runEslintWithConfigFile, readmeBlock("eslint-typescript-extended"));
    assertNoParseErrors(reports);
    assert.deepEqual(typescriptReports(reports), extendedExpected(ESLINT_UNUSED_VARS));
    assert.deepEqual(reports.flatMap((report) => report.warnings), []);
  });

  it("Oxlint: the native typescript and promise plugins report the same rules, in the same files, as errors", async () => {
    const reports = await onFixtures(FIXTURES, (dir) => runOxlint(dir, [], readmeBlock("oxlint-typescript-extended")));
    assertNoParseErrors(reports);
    assert.deepEqual(typescriptReports(reports), extendedExpected(OXLINT_UNUSED_VARS));
    assert.deepEqual(reports.flatMap((report) => report.warnings.filter((rule) => TYPESCRIPT_RELATED.test(rule))), []);
  });

  it("Oxlint: typescriptExtended alone loads no JS plugin, and reports the type assertion and the .then() with a rejection callback", async () => {
    const reports = await onFixtures(FIXTURES, (dir) => runOxlint(dir, [], OXLINT_EXTENDED_ALONE));
    assert.deepEqual(typescriptReports(reports), {
      "src/assertion.ts": ["@typescript-eslint/consistent-type-assertions"],
      "src/dom.ts": ["@typescript-eslint/triple-slash-reference"],
      "src/fetch.js": ["promise/prefer-catch"],
    });
    assert.deepEqual(reports.flatMap((report) => report.rules).filter((rule) => rule.startsWith("clean-code-book/")), []);
  });
});

describe("the typescript-extended-type-checked config", () => {
  it("ESLint: also reports the floating saveOrder(order) and the switch that misses a member of the union", async () => {
    const reports = await onFixtures(FIXTURES, runEslintWithConfigFile, readmeBlock("eslint-typescript-extended-type-checked"));
    assertNoParseErrors(reports);
    assert.deepEqual(typescriptReports(reports), {
      ...extendedExpected(ESLINT_UNUSED_VARS),
      "src/orders.ts": ["@typescript-eslint/no-floating-promises", "@typescript-eslint/switch-exhaustiveness-check"],
    });
  });

  it("ESLint: typescript-extended alone, without type information, does not report orders.ts", async () => {
    const reports = await onFixtures(FIXTURES, runEslintWithConfigFile, readmeBlock("eslint-typescript-extended"));
    assert.ok(reports.some((report) => report.file === "src/orders.ts"), "ESLint did not lint orders.ts, so this check could not fail");
    assert.deepEqual(typescriptReports(reports)["src/orders.ts"], undefined);
  });
});
