/**
 * The catalog's "Regression cases": every failure the audit of `@george2f/eslint-plugin-clean-code` found, run with the whole of
 * `recommended` and every fix applied, under ESLint (`--fix`) and Oxlint (`--fix`, `--fix-suggestions` and `--fix-dangerously`).
 *
 * - `unchanged/`: an `import type`, private and protected constructors, overloads. Every fix applied, the files are byte for byte the same.
 * - `no-report/`: a getOrCreate, fluent setters, parameter objects, discriminated unions, a `this.state` switch, a hoisted function after
 *   `return`, and a test whose only assertion is `assert.equal`. `recommended` reports nothing on them.
 * - `semicolons/`: code without semicolons where fixes remove or move code next to a line that starts with `;`. Every such `;`
 *   survives, and the fixed code gives the same results as the original.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import vm from "node:vm";
import plugin from "../src/index.ts";
import { ROOT, copyFixtures, readTree, runEslint, runOxlint } from "./support.ts";

const FIXTURES = join(ROOT, "test", "fixtures", "regression");
const OXLINT_FIX_MODES = [["--fix"], ["--fix", "--fix-suggestions"], ["--fix-dangerously"]];

function sourceFiles(tree: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(tree).filter(([name]) => name !== "oxlint.config.ts"));
}

/** Runs the module text with its `export`s dropped, then `expression`, and returns the JSON of the result. */
function evaluate(code: string, expression: string): string {
  const script = code.replace(/^export\s+/gm, "");
  return JSON.stringify(vm.runInNewContext(`${script}\n;(${expression})`, {}));
}

const SEMICOLON_CHECKS: Record<string, string> = {
  "no-semicolons.js": "[run(), count(3), log]",
  "field-after-generator.js": "[...new Bag().values()]",
};

function leadingSemicolons(text: string): number {
  return text.split("\n").filter((line) => line.trimStart().startsWith(";")).length;
}

function checkSemicolons(before: Record<string, string>, after: Record<string, string>): void {
  for (const [name, expression] of Object.entries(SEMICOLON_CHECKS)) {
    assert.ok(leadingSemicolons(after[name]) >= leadingSemicolons(before[name]), `${name}: a leading ; was removed:\n${after[name]}`);
    assert.equal(evaluate(after[name], expression), evaluate(before[name], expression), `${name} behaves differently after the fixes:\n${after[name]}`);
  }
}

describe("regression cases under ESLint with --fix", () => {
  it("unchanged/: every fix applied, the import stays type-only and no constructor or overload is removed", async () => {
    const work = copyFixtures(join(FIXTURES, "unchanged"));
    try {
      await runEslint(work.dir, plugin.configs.recommended, true);
      assert.deepEqual(sourceFiles(readTree(work.dir)), readTree(join(FIXTURES, "unchanged")));
    } finally {
      work.dispose();
    }
  });

  it("no-report/: recommended reports nothing", async () => {
    const reports = await runEslint(join(FIXTURES, "no-report"), plugin.configs.recommended);
    assert.deepEqual(reports.filter((report) => report.rules.length > 0), []);
  });

  it("semicolons/: every leading ; survives and the code behaves the same", async () => {
    const work = copyFixtures(join(FIXTURES, "semicolons"));
    try {
      await runEslint(work.dir, plugin.configs.recommended, true);
      checkSemicolons(readTree(join(FIXTURES, "semicolons")), readTree(work.dir));
    } finally {
      work.dispose();
    }
  });
});

describe("regression cases under Oxlint", () => {
  for (const mode of OXLINT_FIX_MODES) {
    it(`unchanged/ with ${mode.join(" ")}: the files are the same`, () => {
      const work = copyFixtures(join(FIXTURES, "unchanged"));
      try {
        runOxlint(work.dir, mode);
        assert.deepEqual(sourceFiles(readTree(work.dir)), readTree(join(FIXTURES, "unchanged")));
      } finally {
        work.dispose();
      }
    });

    it(`semicolons/ with ${mode.join(" ")}: every leading ; survives and the code behaves the same`, () => {
      const work = copyFixtures(join(FIXTURES, "semicolons"));
      try {
        runOxlint(work.dir, mode);
        checkSemicolons(readTree(join(FIXTURES, "semicolons")), sourceFiles(readTree(work.dir)));
      } finally {
        work.dispose();
      }
    });
  }

  it("no-report/: recommended reports nothing", () => {
    const work = copyFixtures(join(FIXTURES, "no-report"));
    try {
      assert.deepEqual(runOxlint(work.dir), []);
    } finally {
      work.dispose();
    }
  });
});
