/**
 * Ticket acceptance: "Given a frontend project on ESLint 10 flat config, and one on Oxlint, When each follows the README's
 * setup for its linter, Then recommended loads and reports on TS, JS, JSX and TSX files."
 *
 * Each test writes a config block of README.md, as written, into a project directory (`eslint.config.js` or
 * `oxlint.config.ts`), so the README cannot show a setup that does not work. Each linter loads the BUILT package by its name,
 * the way an installed project does, and reports one built-in rule (`max-params`) and one custom rule
 * (`return-boolean-directly`) in a file of each language.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Linter } from "eslint";
import { readmeBlock, runEslint, runEslintWithConfigFile, runOxlint, workDirectory, type Report } from "./support.ts";

const BODY = `export function add(a, b, c, d) {\n  return a + b + c + d;\n}\n\nexport function isBig(n) {\n  if (n > 9) {\n    return true;\n  }\n  return false;\n}\n`;
const TYPED_BODY = BODY.replace("(a, b, c, d)", "(a: number, b: number, c: number, d: number)").replace("(n)", "(n: number)");
const FILES = {
  "plain.js": BODY,
  "component.jsx": `${BODY}\nexport const view = <p>{add(1, 2, 3, 4)}</p>;\n`,
  "typed.ts": TYPED_BODY,
  "component.tsx": `${TYPED_BODY}\nexport const view = <p>{add(1, 2, 3, 4)}</p>;\n`,
};
const EXPECTED = ["max-params", "clean-code-book/return-boolean-directly"];

const packageName = "eslint-plugin-clean-code-book";
const CONFIG_FILES = new Set(["eslint.config.js", "oxlint.config.ts"]);

/** The reports on the project's source files, leaving out the config file the README asks for. */
function sourceReports(reports: Report[]): Report[] {
  return reports.filter((report) => !CONFIG_FILES.has(report.file));
}

function assertRecommendedReportsEveryLanguage(reports: Report[]): void {
  assert.deepEqual(sourceReports(reports).map((report) => report.file).sort(), Object.keys(FILES).sort());
  for (const report of sourceReports(reports)) {
    for (const rule of EXPECTED) assert.ok(report.rules.includes(rule), `${report.file}: ${rule} not reported; got ${report.rules.join(", ")}`);
    assert.ok(!report.rules.some((rule) => rule.startsWith("fatal")), `${report.file}: ${report.rules.join(", ")}`);
  }
}

/**
 * A function with a boolean flag and four parameters, below the helper it calls: `max-params` (3), `no-flag-argument` and
 * `stepdown-order` all report it under `recommended`, so the README's "Changing a rule" blocks have something to change.
 */
const CHANGED_FILE = `function helper(): number {
  return 1;
}

export function main(verbose: boolean, first: number, second: number, third: number): number {
  return verbose ? first + helper() : second + third;
}
`;
/** A 25-line test: longer than `max-lines-per-function` allows anywhere, which `recommended` does not report in a test file. */
const LONG_TEST_FILE = `import { it } from "node:test";
import assert from "node:assert/strict";

it("adds", () => {
${Array.from({ length: 25 }, () => "  assert.equal(1 + 1, 2);\n").join("")}});
`;
const CHANGED_RULES = ["max-params", "clean-code-book/no-flag-argument", "clean-code-book/stepdown-order"];

/** Which of CHANGED_RULES the one source file got, each as `rule (error)` or `rule (warning)`. */
function changedRulesReported(reports: Report[]): string[] {
  const [report] = sourceReports(reports);
  return CHANGED_RULES.filter((rule) => report.rules.includes(rule)).map((rule) => `${rule} (${report.warnings.includes(rule) ? "warning" : "error"})`);
}
const ALL_ERRORS = CHANGED_RULES.map((rule) => `${rule} (error)`);
const AFTER_CHANGE = ["clean-code-book/no-flag-argument (warning)"];

describe("the README setup", () => {
  it("ESLint 10 flat config: the README's eslint.config.js loads recommended and reports on JS, JSX, TS and TSX", async () => {
    const work = workDirectory({ ...FILES, "eslint.config.js": readmeBlock("eslint") });
    try {
      assertRecommendedReportsEveryLanguage(await runEslintWithConfigFile(work.dir));
    } finally {
      work.dispose();
    }
  });

  it("ESLint: a CommonJS file is parsed as a script, so sloppy-mode code in it is not a parse error", async () => {
    const plugin = (await import(packageName)).default as { configs: Record<string, Linter.Config[]> };
    const work = workDirectory({ "legacy.cjs": "var package = 1;\nmodule.exports = { value: package + 010 };\n" });
    try {
      const eslintReports = await runEslint(work.dir, plugin.configs.recommended, false, ["**/*.cjs"]);
      assert.deepEqual(eslintReports.flatMap((report) => report.rules.filter((rule) => rule.startsWith("fatal"))), []);
    } finally {
      work.dispose();
    }
  });

  it("Oxlint: the README's oxlint.config.ts loads recommended and reports on JS, JSX, TS and TSX", () => {
    const work = workDirectory(FILES);
    try {
      assertRecommendedReportsEveryLanguage(runOxlint(work.dir, [], readmeBlock("oxlint")));
    } finally {
      work.dispose();
    }
  });

  it("ESLint: the README's recommended-type-checked setup reads the tsconfig and reports a type-aware rule", async () => {
    const work = workDirectory({
      "eslint.config.js": readmeBlock("eslint-type-checked"),
      "tsconfig.json": JSON.stringify({ compilerOptions: { strict: true, module: "NodeNext", target: "ES2022", skipLibCheck: true, types: [] }, include: ["*.ts"] }),
      "shapes.ts": "export class Base {\n  area(): number {\n    return 0;\n  }\n}\n\nexport function isNone(value: number): string {\n  return value === 0 ? \"yes\" : \"no\";\n}\n",
      "plain.js": BODY,
    });
    try {
      const reports = await runEslintWithConfigFile(work.dir);
      const shapes = reports.find((report) => report.file === "shapes.ts");
      assert.ok(shapes?.rules.includes("clean-code-book/predicate-returns-boolean"), shapes?.rules.join(", "));
      const plain = reports.find((report) => report.file === "plain.js");
      assert.ok(plain?.rules.includes("clean-code-book/return-boolean-directly"), plain?.rules.join(", "));
      for (const report of reports) assert.ok(!report.rules.some((rule) => rule.startsWith("fatal")), `${report.file}: ${report.rules.join(", ")}`);
    } finally {
      work.dispose();
    }
  });

  it("ESLint: the README's \"Changing a rule\" block raises a threshold, lowers a rule to a warning and turns one off", async () => {
    const before = workDirectory({ "changed.ts": CHANGED_FILE, "eslint.config.js": readmeBlock("eslint") });
    const after = workDirectory({ "changed.ts": CHANGED_FILE, "eslint.config.js": readmeBlock("eslint-changed") });
    try {
      assert.deepEqual(changedRulesReported(await runEslintWithConfigFile(before.dir)), ALL_ERRORS);
      assert.deepEqual(changedRulesReported(await runEslintWithConfigFile(after.dir)), AFTER_CHANGE);
    } finally {
      before.dispose();
      after.dispose();
    }
  });

  it("ESLint and Oxlint: the README's \"Changing a rule\" blocks leave test files as recommended has them", async () => {
    const eslintWork = workDirectory({ "long.test.ts": LONG_TEST_FILE, "eslint.config.js": readmeBlock("eslint-changed") });
    const oxlintWork = workDirectory({ "long.test.ts": LONG_TEST_FILE });
    try {
      const rulesOn = (reports: Report[]) => sourceReports(reports).flatMap((report) => report.rules).filter((rule) => rule === "max-lines-per-function");
      assert.deepEqual(rulesOn(await runEslintWithConfigFile(eslintWork.dir)), []);
      assert.deepEqual(rulesOn(runOxlint(oxlintWork.dir, [], readmeBlock("oxlint-changed"))), []);
    } finally {
      eslintWork.dispose();
      oxlintWork.dispose();
    }
  });

  it("Oxlint: the README's \"Changing a rule\" block raises a threshold, lowers a rule to a warning and turns one off", () => {
    const before = workDirectory({ "changed.ts": CHANGED_FILE });
    const after = workDirectory({ "changed.ts": CHANGED_FILE });
    try {
      assert.deepEqual(changedRulesReported(runOxlint(before.dir, [], readmeBlock("oxlint"))), ALL_ERRORS);
      assert.deepEqual(changedRulesReported(runOxlint(after.dir, [], readmeBlock("oxlint-changed"))), AFTER_CHANGE);
    } finally {
      before.dispose();
      after.dispose();
    }
  });
});
