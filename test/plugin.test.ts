/**
 * The plugin against its catalog, its configs and its docs:
 * - every custom rule in the catalog's rule table is registered and in the config its class names, and nothing else is;
 * - type-aware rules are only in `recommended-type-checked`; every rule is `"error"`; the book's stated thresholds are used;
 * - every rule has its doc page, with "Why there is no autofix" exactly when it has no fix;
 * - every message names the problem, the book passage and the refactor;
 * - the README lists every rule under the config it is in, with its doc page and whether it fixes;
 * - nothing published carries the organisation's branding, the toolchain is a dev dependency only, and the package ships
 *   its build, its rule docs, the README and the LICENSE.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import type { Linter } from "eslint";
import plugin from "../src/index.ts";
import { recommended as oxlintRecommended } from "../src/oxlint.ts";
import { BUILT_IN_RULES, PLUGIN_PREFIX, SYNTAX_RULES, TEST_FILE_RULES, TYPE_CHECKED_RULES } from "../src/configs.ts";
import { PACKAGE_NAME } from "../src/lib/define-rule.ts";
import { ROOT } from "./support.ts";

const catalog = readFileSync(join(ROOT, "docs", "catalog.md"), "utf8");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const readme = readFileSync(join(ROOT, "README.md"), "utf8");
const rules = plugin.rules as unknown as Record<string, { meta: { fixable?: string; messages: Record<string, string>; docs: { url: string; requiresTypeChecking: boolean } } }>;

interface TableRow {
  names: string[];
  config: string;
  fix: string;
}

/** The cells of a markdown table row. A `|` inside a cell is written `\\|`, as GitHub tables need, so only an unescaped `|` ends one. */
function tableCells(line: string): string[] {
  return line.split(/(?<!\\)\|/).slice(1, -1).map((cell) => cell.trim());
}

/** The rows of the catalog's "The rule set at a glance" table. */
function ruleTable(): TableRow[] {
  const section = catalog.slice(catalog.indexOf("## The rule set at a glance"), catalog.indexOf("## Entries"));
  return section.split("\n").filter((line) => /^\| `/.test(line)).map((line) => {
    const [names, , config, , fix] = tableCells(line);
    return { names: [...names.matchAll(/`([^`]+)`/g)].map((match) => match[1]), config, fix };
  });
}

const BUILT_IN_NAMES = new Set([...Object.keys(BUILT_IN_RULES), "no-unused-vars", "@typescript-eslint/no-unused-vars", "@typescript-eslint/prefer-for-of"]);

function rulesOf(config: Linter.Config[]): Record<string, unknown> {
  return Object.assign({}, ...config.map((entry) => entry.rules ?? {}));
}

function severity(setting: unknown): unknown {
  return Array.isArray(setting) ? setting[0] : setting;
}

describe("the catalog's rule table", () => {
  const customRows = ruleTable().filter((row) => !row.names.some((name) => BUILT_IN_NAMES.has(name)));

  it("every built-in rule in the table is configured", () => {
    const builtIns = ruleTable().flatMap((row) => row.names).filter((name) => BUILT_IN_NAMES.has(name));
    const configured = rulesOf(plugin.configs.recommended);
    for (const name of builtIns) assert.ok(name in configured, `${name} is not in recommended`);
  });

  it("every custom rule in the table is registered, and every registered rule is in the table", () => {
    const tableNames = new Set(customRows.flatMap((row) => row.names));
    assert.deepEqual([...tableNames].sort(), Object.keys(rules).sort());
  });

  it("each custom rule is in the config the table names, and only that one", () => {
    const recommended = rulesOf(plugin.configs.recommended);
    const typeChecked = rulesOf(plugin.configs["recommended-type-checked"]);
    for (const row of customRows) {
      for (const name of row.names) {
        const key = `clean-code-book/${name}`;
        if (row.config === "recommended-type-checked" && !(key in recommended)) {
          assert.ok(rules[name].meta.docs.requiresTypeChecking, `${name} should need type information`);
          assert.ok(key in typeChecked, `${name} is not in recommended-type-checked`);
        } else {
          assert.ok(key in recommended, `${name} is not in recommended`);
          assert.ok(!rules[name].meta.docs.requiresTypeChecking, `${name} needs types but is in recommended`);
        }
      }
    }
  });

  it("a rule the table marks as fixed has a fix, and a rule marked 'no fix' has none", () => {
    for (const row of customRows) {
      assert.match(row.fix, /^(no fix|\*\*fix\*\*.*)$/, `${row.names.join(", ")}: the Fix cell reads "${row.fix}"`);
      for (const name of row.names) {
        if (row.fix === "no fix") assert.equal(rules[name].meta.fixable, undefined, `${name} should have no fix`);
        else if (row.fix.includes("fix")) assert.equal(rules[name].meta.fixable, "code", `${name} should have a fix`);
      }
    }
  });
});

describe("the configs", () => {
  it("every rule in every config is an error", () => {
    for (const [name, config] of Object.entries(plugin.configs as Record<string, Linter.Config[]>)) {
      for (const [rule, setting] of Object.entries(rulesOf(config))) {
        if (severity(setting) === "off") continue;
        assert.equal(severity(setting), "error", `${name}: ${rule}`);
      }
    }
  });

  it("uses the thresholds the book states", () => {
    const configured = plugin.configs.recommended[0].rules as Record<string, unknown[]>;
    assert.deepEqual(configured["max-params"], ["error", { max: 3, countThis: "never" }]);
    assert.deepEqual(configured["max-lines-per-function"], ["error", { max: 12, skipBlankLines: true, skipComments: true }]);
    assert.deepEqual(configured["max-depth"], ["error", { max: 2 }]);
    assert.deepEqual(configured["max-lines"], ["error", { max: 500 }]);
    assert.deepEqual(configured["max-classes-per-file"], ["error", { max: 1 }]);
  });

  it("the type-aware rules are in recommended-type-checked and not in recommended or the Oxlint config", () => {
    const recommended = rulesOf(plugin.configs.recommended);
    const oxlint = { ...oxlintRecommended.rules, ...oxlintRecommended.overrides[0].rules };
    for (const name of TYPE_CHECKED_RULES) {
      assert.ok(!(`clean-code-book/${name}` in recommended), name);
      assert.ok(!(`clean-code-book/${name}` in oxlint), name);
    }
  });

  it("the Oxlint config has the same custom rules as ESLint's recommended", () => {
    const eslint = Object.keys(rulesOf(plugin.configs.recommended)).filter((name) => name.startsWith("clean-code-book/"));
    const oxlint = Object.keys({ ...oxlintRecommended.rules, ...oxlintRecommended.overrides[0].rules }).filter((name) => name.startsWith("clean-code-book/"));
    assert.deepEqual(oxlint.sort(), eslint.sort());
    assert.equal(eslint.length, SYNTAX_RULES.length + TEST_FILE_RULES.length);
  });
});

describe("the rule docs and messages", () => {
  for (const [name, rule] of Object.entries(rules)) {
    it(`${name} has its doc page, with the sections its fix calls for`, () => {
      const path = join(ROOT, "docs", "rules", `${name}.md`);
      assert.ok(existsSync(path), `docs/rules/${name}.md is missing`);
      const doc = readFileSync(path, "utf8");
      assert.match(doc, new RegExp(`^# clean-code-book/${name}\\n`));
      assert.match(doc, /\n## What the book says\n\n> "/);
      assert.match(doc, /\n## What it reports\n/);
      assert.match(doc, /\n## Examples\n/);
      if (rule.meta.fixable) assert.match(doc, /\n## Fix\n/);
      else assert.match(doc, /\n## Why there is no autofix\n/);
      assert.equal(rule.meta.docs.url, `https://unpkg.com/${PACKAGE_NAME}/docs/rules/${name}.md`);
    });

    it(`${name}: every message names the problem, the book passage and the refactor`, () => {
      for (const message of Object.values(rule.meta.messages)) {
        assert.match(message, /^.+ Clean Code, \d+ [^:]+: ".+" Refactor: .+$/s);
      }
    });
  }
});

describe("the published package", () => {
  it("has an unscoped name, and the toolchain is a dev dependency only", () => {
    assert.equal(pkg.name, PACKAGE_NAME);
    assert.doesNotMatch(pkg.name, /^@/);
    assert.ok(pkg.devDependencies["@a11ign/toolchain"]);
    assert.equal(pkg.dependencies?.["@a11ign/toolchain"], undefined);
    assert.equal(pkg.peerDependencies?.["@a11ign/toolchain"], undefined);
  });

  it("its README, rule docs and rule URLs carry no organisation branding", () => {
    const docs = readdirSync(join(ROOT, "docs", "rules")).map((file) => readFileSync(join(ROOT, "docs", "rules", file), "utf8"));
    for (const text of [readme, ...docs, ...Object.values(rules).map((rule) => rule.meta.docs.url)]) assert.doesNotMatch(text, /a11ign/i);
  });

  it("ships the build, every rule's doc page, the README and the LICENSE, and no source or tests", () => {
    const packed = spawnSync("npm", ["pack", "--dry-run", "--ignore-scripts", "--json"], { cwd: ROOT, encoding: "utf8" });
    assert.equal(packed.status, 0, packed.stderr);
    const files = new Set((JSON.parse(packed.stdout) as Array<{ files: Array<{ path: string }> }>)[0].files.map((file) => file.path));
    const expected = ["README.md", "LICENSE", "package.json", "dist/index.mjs", "dist/plugin.mjs", "dist/oxlint.mjs", "dist/index.d.ts"];
    for (const path of [...expected, ...Object.keys(rules).map((name) => `docs/rules/${name}.md`)]) assert.ok(files.has(path), `${path} is not in the package`);
    for (const path of files) assert.match(path, /^(dist\/|docs\/rules\/|README\.md$|LICENSE$|package\.json$)/);
  });
});

describe("the README", () => {
  /** The rule names in the README's table under `### <heading>`, each with its link and its Fix cell. */
  function readmeTable(heading: string): Array<{ name: string; link: string; fix: string }> {
    const start = readme.indexOf(`\n### ${heading}\n`);
    assert.notEqual(start, -1, `the README has no "### ${heading}" section`);
    const section = readme.slice(start + 1).split(/\n#{2,3} /)[0];
    return section.split("\n").filter((line) => /^\| \[?`/.test(line)).map((line) => {
      const cells = tableCells(line);
      const [, name, link = ""] = /^\[?`([^`]+)`\]?(?:\(([^)]+)\))?/.exec(cells[0]) ?? [];
      return { name, link, fix: cells[2] };
    });
  }

  const SECTIONS = [
    ["In `recommended`", SYNTAX_RULES],
    ["In `recommended`, for test files only", TEST_FILE_RULES],
    ["In `recommended-type-checked` only", TYPE_CHECKED_RULES],
  ] as const;

  for (const [heading, configured] of SECTIONS) {
    it(`lists exactly the rules of "${heading}", each linked to its doc page, with its fix`, () => {
      const rows = readmeTable(heading);
      assert.deepEqual(rows.map((row) => row.name).sort(), [...configured].sort());
      for (const row of rows) {
        assert.equal(row.link, `docs/rules/${row.name}.md`);
        assert.ok(existsSync(join(ROOT, row.link)), row.link);
        assert.equal(row.fix === "no", !rules[row.name].meta.fixable, `${row.name}: the README says fix "${row.fix}"`);
      }
    });
  }

  it("lists exactly the built-in rules recommended turns on", () => {
    const listed = readmeTable("Built-in rules").map((row) => row.name).sort();
    const builtIns = Object.keys(rulesOf(plugin.configs.recommended)).filter((name) => !name.startsWith(`${PLUGIN_PREFIX}/`));
    const expected = builtIns.filter((name) => name !== "@typescript-eslint/no-unused-vars").sort();
    assert.deepEqual(listed, expected);
  });
});
