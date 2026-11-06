/**
 * The ticket's acceptance for the opt-in `react` and `react-extended` configs, end to end: the README's setup blocks, as written,
 * under ESLint and under Oxlint, on the files in `test/fixtures/react/`, which hold one case for each scenario. Each linter loads
 * the BUILT package by its name, the way an installed project does.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ESLint } from "eslint";
import { ROOT, copyFixtures, readmeBlock, runEslintWithConfigFile, runOxlint, type Report } from "./support.ts";

const FIXTURES = join(ROOT, "test", "fixtures", "react");

/**
 * The rules this ticket is about: the `react-` rules, the four `react-extended` rules (under the same names in either linter's
 * report), and FN-01's `max-lines-per-function`, which `react` keeps.
 */
const REACT_RELATED = /^(clean-code-book\/react-|react-hooks\/(rules-of-hooks|exhaustive-deps)$|react\/(jsx-key|no-array-index-key)$|max-lines-per-function$)/;

/** What `recommended` and `react` report in each fixture file, under either linter. */
const REACT_EXPECTED: Record<string, string[]> = {
  "src/List.tsx": ["clean-code-book/react-no-state-mutation"],
  "src/Panel.tsx": ["max-lines-per-function"],
  "src/Users.tsx": ["clean-code-book/react-no-untyped-empty-state"],
};

/** `react-extended` adds the rules of hooks, on components and on the `useChecked.ts` hook, and the list-key rules on `.tsx`. */
const EXTENDED_EXPECTED: Record<string, string[]> = {
  ...REACT_EXPECTED,
  "src/Dialog.tsx": ["react-hooks/rules-of-hooks"],
  "src/Orders.tsx": ["react/no-array-index-key"],
  "src/Profile.tsx": ["react-hooks/exhaustive-deps"],
  "src/Tags.tsx": ["react/jsx-key"],
  "src/useChecked.ts": ["react-hooks/rules-of-hooks"],
};

/** The react-related rules each file got, sorted, leaving out the files that got none. */
function reactReports(reports: Report[]): Record<string, string[]> {
  const byFile = reports.map((report) => [report.file, report.rules.filter((rule) => REACT_RELATED.test(rule)).sort()] as const);
  return Object.fromEntries(byFile.filter(([, rules]) => rules.length > 0).sort(([a], [b]) => a.localeCompare(b)));
}

/** Every rule, react-related or not, reported in `file`. */
function rulesIn(reports: Report[], file: string): string[] {
  return reports.find((report) => report.file === file)?.rules ?? [];
}

function assertNoParseErrors(reports: Report[]): void {
  for (const report of reports) assert.ok(!report.rules.some((rule) => rule.startsWith("fatal")), `${report.file}: ${report.rules.join(", ")}`);
}

/** The react-related reports that are warnings rather than errors. */
function reactWarnings(reports: Report[]): string[] {
  return reports.flatMap((report) => report.warnings.filter((rule) => REACT_RELATED.test(rule)));
}

/** Runs `lint` on a fresh copy of the fixtures, with `eslint.config.js` set to `eslintConfig` when one is given. */
async function onFixtures<T>(lint: (dir: string) => Promise<T> | T, eslintConfig?: string, prepare?: (dir: string) => void): Promise<T> {
  const work = copyFixtures(FIXTURES);
  try {
    if (eslintConfig) writeFileSync(join(work.dir, "eslint.config.js"), eslintConfig);
    prepare?.(work.dir);
    return await lint(work.dir);
  } finally {
    work.dispose();
  }
}

/** Copies `from` to `to` in the work directory: the same code under a name the configs do cover, so a check of a skipped file could fail. */
const renamed = (from: string, to: string) => (dir: string) => copyFileSync(join(dir, from), join(dir, to));

const OXLINT_EXTENDED_ALONE = 'import { reactExtended } from "eslint-plugin-clean-code-book/oxlint";\n\nexport default { extends: [reactExtended] };\n';

interface WithoutReactPlugins {
  lengths: Record<string, number>;
  recommendedLint: string;
  extendedLint: string;
}

/**
 * Imports the built package with both React plugins made unresolvable, as in a project that never installed them, lists every
 * config, and lints a component with `recommended`, and with `react` and `react-extended`.
 */
function withoutReactPlugins(): WithoutReactPlugins {
  const script = `
import { registerHooks } from "node:module";
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "eslint-plugin-react" || specifier === "eslint-plugin-react-hooks") {
      throw Object.assign(new Error("Cannot find module '" + specifier + "'"), { code: "MODULE_NOT_FOUND" });
    }
    return next(specifier, context);
  },
});
const { default: cleanCode } = await import("eslint-plugin-clean-code-book");
const { Linter } = await import("eslint");
const lengths = Object.fromEntries(Object.entries(cleanCode.configs).map(([name, config]) => [name, config.length]));
function lint(config) {
  try {
    new Linter().verify("export function A() { return <p />; }", config, "file.jsx");
    return "ok";
  } catch (error) {
    return error.message;
  }
}
const recommendedLint = lint([...cleanCode.configs.recommended, ...cleanCode.configs.react]);
const extendedLint = lint([...cleanCode.configs.react, ...cleanCode.configs["react-extended"]]);
console.log(JSON.stringify({ lengths, recommendedLint, extendedLint }));
`;
  const run = spawnSync(process.execPath, ["--input-type=module", "-e", script], { cwd: ROOT, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout);
}

describe("the react config", () => {
  it("ESLint: the README's react setup reports the state mutation, the untyped empty state and the 20-line component", async () => {
    const reports = await onFixtures(runEslintWithConfigFile, readmeBlock("eslint-react"));
    assertNoParseErrors(reports);
    assert.deepEqual(reactReports(reports), REACT_EXPECTED);
  });

  it("Oxlint: the README's react setup reports the same rules as ESLint, in the same files", async () => {
    const reports = await onFixtures((dir) => runOxlint(dir, [], readmeBlock("oxlint-react")));
    assertNoParseErrors(reports);
    assert.deepEqual(reactReports(reports), REACT_EXPECTED);
  });

  it("ESLint: each react- report is an error, with no fix and no suggestion, and the 20-line component is held to 12 lines", async () => {
    await onFixtures(async (dir) => {
      const results = await new ESLint({ cwd: dir }).lintFiles(["src/*.{ts,tsx}"]);
      const messages = results.flatMap((result) => result.messages).filter((message) => message.ruleId?.startsWith("clean-code-book/react-"));
      assert.equal(messages.length, 2);
      for (const message of messages) {
        assert.equal(message.severity, 2, message.ruleId ?? "");
        assert.equal(message.fix, undefined, `${message.ruleId} has a fix`);
        assert.equal(message.suggestions, undefined, `${message.ruleId} has a suggestion`);
      }
      assert.equal(messages.find((message) => message.ruleId === "clean-code-book/react-no-state-mutation")?.line, 6);
      const panel = results.find((result) => result.filePath.endsWith("Panel.tsx"))?.messages.find((message) => message.ruleId === "max-lines-per-function");
      assert.match(panel?.message ?? "", /has too many lines \(20\)\. Maximum allowed is 12\./);
    }, readmeBlock("eslint-react"));
  });

  it("ESLint and Oxlint: a plain .ts file is not checked by any react- rule, though the same code in a .tsx file is", async () => {
    const control = renamed("src/store.ts", "src/store.tsx");
    const eslintReports = await onFixtures(runEslintWithConfigFile, readmeBlock("eslint-react"), control);
    const oxlintReports = await onFixtures((dir) => runOxlint(dir, [], readmeBlock("oxlint-react")), undefined, control);
    assert.ok(eslintReports.some((report) => report.file === "src/store.ts"), "ESLint did not lint store.ts, so this check could not fail");
    for (const reports of [eslintReports, oxlintReports]) {
      assert.deepEqual(rulesIn(reports, "src/store.ts").filter((rule) => rule.includes("react")), []);
      assert.deepEqual(rulesIn(reports, "src/store.tsx").filter((rule) => rule.startsWith("clean-code-book/react-")).sort(), [
        "clean-code-book/react-no-state-mutation",
        "clean-code-book/react-no-untyped-empty-state",
      ]);
    }
  });

  it("ESLint and Oxlint: a project on recommended alone gets no react report, and still the 12-line limit on the component", async () => {
    const eslintReports = await onFixtures(runEslintWithConfigFile, readmeBlock("eslint"));
    const oxlintReports = await onFixtures((dir) => runOxlint(dir, [], readmeBlock("oxlint")));
    assert.deepEqual(reactReports(eslintReports), { "src/Panel.tsx": ["max-lines-per-function"] });
    assert.deepEqual(reactReports(oxlintReports), { "src/Panel.tsx": ["max-lines-per-function"] });
  });

  it("ESLint: without the React plugins, every config can be listed and react lints, and linting with react-extended says to install them", () => {
    const result = withoutReactPlugins();
    assert.deepEqual(Object.keys(result.lengths), ["recommended", "recommended-type-checked", "ai", "node", "node-extended", "react", "react-extended"]);
    assert.ok(Object.values(result.lengths).every((length) => length > 0), JSON.stringify(result.lengths));
    assert.equal(result.recommendedLint, "ok");
    assert.match(result.extendedLint, /react-extended config needs eslint-plugin-react(-hooks)?: npm install --save-dev eslint-plugin-react(-hooks)?/);
  });
});

describe("the react-extended config", () => {
  it("ESLint: the rules of hooks, exhaustive-deps and the list-key rules report each scenario", async () => {
    const reports = await onFixtures(runEslintWithConfigFile, readmeBlock("eslint-react-extended"));
    assertNoParseErrors(reports);
    assert.deepEqual(reactReports(reports), EXTENDED_EXPECTED);
    assert.deepEqual(reactWarnings(reports), [], "exhaustive-deps is an error, not the preset's warning");
  });

  it("Oxlint: the native react plugin reports the same rules, in the same files, as errors", async () => {
    const reports = await onFixtures((dir) => runOxlint(dir, [], readmeBlock("oxlint-react-extended")));
    assertNoParseErrors(reports);
    assert.deepEqual(reactReports(reports), EXTENDED_EXPECTED);
    assert.deepEqual(reactWarnings(reports), []);
  });

  it("ESLint and Oxlint: useOrders.ts is not checked by any react/ rule, though the same code in a .tsx file is", async () => {
    const control = renamed("src/useOrders.ts", "src/useOrders.tsx");
    const eslintReports = await onFixtures(runEslintWithConfigFile, readmeBlock("eslint-react-extended"), control);
    const oxlintReports = await onFixtures((dir) => runOxlint(dir, [], readmeBlock("oxlint-react-extended")), undefined, control);
    for (const reports of [eslintReports, oxlintReports]) {
      assert.deepEqual(rulesIn(reports, "src/useOrders.ts").filter((rule) => rule.startsWith("react/")), []);
      assert.deepEqual(rulesIn(reports, "src/useOrders.tsx").filter((rule) => rule.startsWith("react/")), ["react/no-array-index-key"]);
    }
  });

  it("Oxlint: reactExtended alone loads no JS plugin, and reports the conditional hook in the component and in useChecked.ts", async () => {
    const reports = await onFixtures((dir) => runOxlint(dir, [], OXLINT_EXTENDED_ALONE));
    assert.deepEqual(rulesIn(reports, "src/Dialog.tsx").filter((rule) => REACT_RELATED.test(rule)), ["react-hooks/rules-of-hooks"]);
    assert.deepEqual(rulesIn(reports, "src/useChecked.ts").filter((rule) => REACT_RELATED.test(rule)), ["react-hooks/rules-of-hooks"]);
    assert.deepEqual(reports.flatMap((report) => report.rules).filter((rule) => rule.startsWith("clean-code-book/")), []);
  });
});
