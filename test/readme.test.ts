/**
 * The README lists every rule under the config it is in, with its doc page and whether it fixes.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import plugin from "../src/index.ts";
import { AI_RULES, NODE_EXTENDED_RULES, NODE_RULES, PLUGIN_PREFIX, REACT_RULES, SYNTAX_RULES, TEST_FILE_RULES, TYPE_CHECKED_RULES, TYPESCRIPT_RULES } from "../src/configs.ts";
import { docPath, readme, rules, rulesOf, tableCells } from "./plugin-support.ts";
import { ROOT } from "./support.ts";

/** A rule the README lists: its name, the doc page it links and its Fix cell. */
interface ReadmeRow {
  name: string;
  link: string;
  fix: string;
}

/** The rule names in the README's table under `### <heading>`, each with its link and its Fix cell. */
function readmeTable(heading: string): ReadmeRow[] {
  const start = readme.indexOf(`\n### ${heading}\n`);
  assert.notEqual(start, -1, `the README has no "### ${heading}" section`);
  const section = readme.slice(start + 1).split(/\n#{2,3} /)[0];
  return section.split("\n").filter((line) => /^\| \[?`/.test(line)).map((line) => {
    const cells = tableCells(line);
    const [, name, link = ""] = /^\[?`([^`]+)`\]?(?:\(([^)]+)\))?/.exec(cells[0]) ?? [];
    return { name, link, fix: cells[2] };
  });
}

describe("the README", () => {
  const SECTIONS = [
    ["In `recommended`", SYNTAX_RULES],
    ["In `recommended`, for test files only", TEST_FILE_RULES],
    ["In `recommended-type-checked` only", TYPE_CHECKED_RULES],
    ["In `ai`", AI_RULES],
    ["In `typescript`", TYPESCRIPT_RULES],
    ["In `node`", NODE_RULES],
    ["In `react`", REACT_RULES],
  ] as const;

  for (const [heading, configured] of SECTIONS) {
    it(`lists exactly the rules of "${heading}", each linked to its doc page, with its fix`, () => {
      const rows = readmeTable(heading);
      assert.deepEqual(rows.map((row) => row.name).sort(), [...configured].sort());
      for (const row of rows) assertLinkedWithItsFix(row);
    });
  }

  it("lists exactly the rules typescript-extended and typescript-extended-type-checked turn on", () => {
    const extended = readmeTable("In `typescript-extended`").map((row) => row.name);
    assert.deepEqual(extended.sort(), Object.keys(rulesOf(plugin.configs["typescript-extended"])).sort());
    const typeChecked = [...extended, ...readmeTable("In `typescript-extended-type-checked`").map((row) => row.name)];
    assert.deepEqual(typeChecked.sort(), Object.keys(rulesOf(plugin.configs["typescript-extended-type-checked"])).sort());
  });

  it("lists exactly the rules node-extended turns on", () => {
    assert.deepEqual(readmeTable("In `node-extended`").map((row) => row.name), Object.keys(NODE_EXTENDED_RULES));
  });

  it("lists exactly the rules react-extended turns on", () => {
    assert.deepEqual(readmeTable("In `react-extended`").map((row) => row.name).sort(), Object.keys(rulesOf(plugin.configs["react-extended"])).sort());
  });

  it("lists exactly the built-in rules recommended turns on", () => {
    const listed = readmeTable("Built-in rules").map((row) => row.name).sort();
    const builtIns = Object.keys(rulesOf(plugin.configs.recommended)).filter((name) => !name.startsWith(`${PLUGIN_PREFIX}/`));
    const expected = builtIns.filter((name) => name !== "@typescript-eslint/no-unused-vars").sort();
    assert.deepEqual(listed, expected);
  });
});

/** The row links the rule's doc page, which exists, and its Fix cell says "no" exactly when the rule has no fix. */
function assertLinkedWithItsFix(row: ReadmeRow): void {
  assert.equal(row.link, docPath(row.name));
  assert.ok(existsSync(join(ROOT, row.link)), row.link);
  assert.equal(row.fix === "no", !rules[row.name].meta.fixable, `${row.name}: the README says fix "${row.fix}"`);
}
