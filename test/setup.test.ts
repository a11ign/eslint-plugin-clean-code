/**
 * Ticket acceptance: "Given a frontend project on ESLint 10 flat config, and one on Oxlint, When each follows the README's
 * setup for its linter, Then recommended loads and reports on TS, JS, JSX and TSX files."
 *
 * Each linter loads the BUILT package by its name, the way an installed project does, and reports one built-in rule
 * (`max-params`) and one custom rule (`return-boolean-directly`) in a file of each language.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Linter } from "eslint";
import { runEslint, runOxlint, workDirectory } from "./support.ts";

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

describe("the README setup", () => {
  it("ESLint 10 flat config: recommended loads from the package and reports on JS, JSX, TS and TSX", async () => {
    const plugin = (await import(packageName)).default as { configs: Record<string, Linter.Config[]> };
    const work = workDirectory(FILES);
    try {
      const reports = await runEslint(work.dir, plugin.configs.recommended);
      assert.deepEqual(reports.map((report) => report.file).sort(), Object.keys(FILES).sort());
      for (const report of reports) {
        for (const rule of EXPECTED) assert.ok(report.rules.includes(rule), `${report.file}: ${rule} not reported; got ${report.rules.join(", ")}`);
        assert.ok(!report.rules.some((rule) => rule.startsWith("fatal")), `${report.file}: ${report.rules.join(", ")}`);
      }
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

  it("Oxlint: recommended loads from the package through oxlint.config.ts and reports on JS, JSX, TS and TSX", () => {
    const work = workDirectory(FILES);
    try {
      const reports = runOxlint(work.dir);
      assert.deepEqual(reports.map((report) => report.file).sort(), Object.keys(FILES).sort());
      for (const report of reports) {
        for (const rule of EXPECTED) assert.ok(report.rules.includes(rule), `${report.file}: ${rule} not reported; got ${report.rules.join(", ")}`);
      }
    } finally {
      work.dispose();
    }
  });

  it("ESLint: recommended-type-checked loads with a tsconfig and reports a type-aware rule", async () => {
    const plugin = (await import(packageName)).default as { configs: Record<string, Linter.Config[]> };
    const work = workDirectory({
      "tsconfig.json": JSON.stringify({ compilerOptions: { strict: true, module: "NodeNext", target: "ES2022", skipLibCheck: true, types: [] }, include: ["*.ts"] }),
      "shapes.ts": "export class Base {\n  area(): number {\n    return 0;\n  }\n}\n\nexport function isNone(value: number): string {\n  return value === 0 ? \"yes\" : \"no\";\n}\n",
    });
    try {
      const config = plugin.configs["recommended-type-checked"].map((entry) => ({ ...entry, languageOptions: { ...entry.languageOptions, parserOptions: { ...(entry.languageOptions?.parserOptions as object | undefined), tsconfigRootDir: work.dir } } }));
      const [report] = await runEslint(work.dir, config);
      assert.ok(report.rules.includes("clean-code-book/predicate-returns-boolean"), report.rules.join(", "));
    } finally {
      work.dispose();
    }
  });
});
