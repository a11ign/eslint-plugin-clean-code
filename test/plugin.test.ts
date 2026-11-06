/**
 * The plugin against its catalog, its configs and its docs:
 * - every book rule in the catalog's rule table is registered and in the config its class names, and nothing else is;
 * - every `ai-` rule is in `docs/catalog-ai.md`'s rule table, with an entry that names its pattern, harm and Language basis,
 *   and is in the `ai` config of both linters and in no other config;
 * - every `node-` rule is in `docs/catalog-node.md`'s rule table and in the `node` config of both linters only, and its
 *   `third-party` rule is in `node-extended` only, with eslint-plugin-n an optional peer dependency;
 * - type-aware rules are only in `recommended-type-checked`; every rule is `"error"`; the book's stated thresholds are used;
 * - every rule has its doc page, with "Why there is no autofix" exactly when it has no fix;
 * - every message names the problem, the book passage (for an `ai` rule, the AI pattern and its harm) and the refactor;
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
import { ai as oxlintAi, node as oxlintNode, nodeExtended as oxlintNodeExtended, recommended as oxlintRecommended } from "../src/oxlint.ts";
import { AI_RULES, BUILT_IN_RULES, NODE_EXTENDED_RULES, NODE_RULES, PLUGIN_PREFIX, SYNTAX_RULES, TEST_FILE_RULES, TYPE_CHECKED_RULES } from "../src/configs.ts";
import { AI_RULE_PREFIX, NODE_RULE_PREFIX, PACKAGE_NAME } from "../src/lib/define-rule.ts";
import { ROOT } from "./support.ts";

const catalog = readFileSync(join(ROOT, "docs", "catalog.md"), "utf8");
const aiCatalog = readFileSync(join(ROOT, "docs", "catalog-ai.md"), "utf8");
const nodeCatalog = readFileSync(join(ROOT, "docs", "catalog-node.md"), "utf8");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const readme = readFileSync(join(ROOT, "README.md"), "utf8");
const rules = plugin.rules as unknown as Record<string, { meta: { fixable?: string; messages: Record<string, string>; docs: { url: string; requiresTypeChecking: boolean; source?: { entry: string; passage: string } } } }>;
const isAiRule = (name: string) => name.startsWith(AI_RULE_PREFIX);
const isNodeRule = (name: string) => name.startsWith(NODE_RULE_PREFIX);
const bookRuleNames = Object.keys(rules).filter((name) => !isAiRule(name) && !isNodeRule(name));
/** Where a rule's doc page is, by the config its prefix names. */
const docPath = (name: string) => (isAiRule(name) ? `docs/rules/ai/${name}.md` : isNodeRule(name) ? `docs/rules/node/${name}.md` : `docs/rules/${name}.md`);

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

  it("every custom rule in the table is registered, and every registered book rule is in the table", () => {
    const tableNames = new Set(customRows.flatMap((row) => row.names));
    assert.deepEqual([...tableNames].sort(), bookRuleNames.sort());
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

describe("the ai catalog", () => {
  /** The rule names in `docs/catalog-ai.md`'s "The rule set at a glance" table, with each row's Entry and Fix cells. */
  function aiTable(): Array<{ name: string; entry: string; fix: string }> {
    const section = aiCatalog.slice(aiCatalog.indexOf("## The rule set at a glance"), aiCatalog.indexOf("## Entries"));
    return section.split("\n").filter((line) => /^\| `/.test(line)).map((line) => {
      const [name, entry, , fix] = tableCells(line);
      return { name: name.replaceAll("`", ""), entry, fix };
    });
  }

  it("lists exactly the registered ai- rules, each with no fix", () => {
    const table = aiTable();
    assert.deepEqual(table.map((row) => row.name).sort(), Object.keys(rules).filter(isAiRule).sort());
    for (const row of table) {
      assert.equal(row.fix, "no fix", row.name);
      assert.equal(rules[row.name].meta.fixable, undefined, `${row.name} should have no fix`);
    }
  });

  it("each rule has an entry that names the AI pattern, its harm and its Language basis", () => {
    for (const { name, entry } of aiTable()) {
      const start = aiCatalog.indexOf(`\n#### ${entry} · `);
      assert.notEqual(start, -1, `docs/catalog-ai.md has no entry ${entry} for ${name}`);
      const body = aiCatalog.slice(start + 1).split(/\n#{2,4} /)[0];
      assert.match(body, new RegExp(`\\*\\*Rule:\\*\\* \`${name}\``), `${entry} names ${name}`);
      assert.match(body, /\n- \*\*AI pattern:\*\* \S/, `${entry} has an AI pattern line`);
      assert.match(body, /\n- \*\*Harm:\*\* \S/, `${entry} has a Harm line`);
      assert.match(body, /\n- \*\*Language basis:\*\* (universal|JS\/TS-specific)\. \S/, `${entry} has a Language basis line`);
    }
  });

  it("leaves the book's catalog alone: it names no ai- rule", () => {
    assert.doesNotMatch(catalog, /`ai-/);
  });
});

describe("the node catalog", () => {
  /** The rows of `docs/catalog-node.md`'s "The rule set at a glance" table that name a rule. */
  function nodeTable(): Array<{ name: string; entry: string; config: string; ruleClass: string; fix: string }> {
    const section = nodeCatalog.slice(nodeCatalog.indexOf("## The rule set at a glance"), nodeCatalog.indexOf("## Entries"));
    return section.split("\n").filter((line) => /^\| `/.test(line)).map((line) => {
      const [name, entry, config, ruleClass, fix] = tableCells(line);
      return { name: name.replaceAll("`", ""), entry, config, ruleClass, fix };
    });
  }

  it("lists exactly the registered node- rules, each a syntax rule in node with no fix", () => {
    const syntaxRows = nodeTable().filter((row) => row.ruleClass === "syntax");
    assert.deepEqual(syntaxRows.map((row) => row.name).sort(), Object.keys(rules).filter(isNodeRule).sort());
    for (const row of syntaxRows) {
      assert.equal(row.config, "node", row.name);
      assert.equal(row.fix, "no fix", row.name);
      assert.equal(rules[row.name].meta.fixable, undefined, `${row.name} should have no fix`);
      assert.equal(rules[row.name].meta.docs.requiresTypeChecking, false, `${row.name} should need no type information`);
    }
  });

  it("each third-party row is in node-extended, and node-extended has no rule the table does not name", () => {
    const thirdParty = nodeTable().filter((row) => row.ruleClass === "third-party");
    assert.deepEqual(thirdParty.map((row) => row.config), ["node-extended"]);
    assert.deepEqual(Object.keys(NODE_EXTENDED_RULES), thirdParty.map((row) => row.name));
  });

  it("leaves the book's catalog alone: it names no node- rule", () => {
    assert.doesNotMatch(catalog, /`node-/);
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

  it("ai turns on exactly the ai- rules, and they are in no other config", () => {
    const ai = Object.keys(plugin.configs.ai[0].rules ?? {});
    assert.deepEqual(ai.sort(), AI_RULES.map((name) => `${PLUGIN_PREFIX}/${name}`).sort());
    assert.deepEqual(Object.keys(rules).filter(isAiRule).sort(), [...AI_RULES].sort());
    for (const config of [plugin.configs.recommended, plugin.configs["recommended-type-checked"], plugin.configs.node, plugin.configs["node-extended"]]) {
      assert.deepEqual(Object.keys(rulesOf(config)).filter((name) => name.includes(`/${AI_RULE_PREFIX}`)), []);
    }
    const oxlint = { ...oxlintRecommended.rules, ...oxlintRecommended.overrides[0].rules, ...oxlintNode.rules, ...oxlintNodeExtended.rules };
    assert.deepEqual(Object.keys(oxlint).filter((name) => name.includes(`/${AI_RULE_PREFIX}`)), []);
  });

  it("the Oxlint ai config has the same rules, and the same test-file exemptions, as ESLint's", () => {
    assert.deepEqual(oxlintAi.rules, plugin.configs.ai[0].rules);
    const eslintTests = plugin.configs.ai.find((entry) => entry.name === `${PLUGIN_PREFIX}/ai/tests`);
    assert.deepEqual(oxlintAi.overrides, [{ files: eslintTests?.files, rules: eslintTests?.rules }]);
  });

  it("node turns on exactly the node- rules, and they are in no other config of either linter", () => {
    assert.deepEqual(Object.keys(rulesOf(plugin.configs.node)).sort(), NODE_RULES.map((name) => `${PLUGIN_PREFIX}/${name}`).sort());
    assert.deepEqual(Object.keys(rules).filter(isNodeRule).sort(), [...NODE_RULES].sort());
    const others = [plugin.configs.recommended, plugin.configs["recommended-type-checked"], plugin.configs.ai, plugin.configs["node-extended"]].map(rulesOf);
    const oxlintOthers = [{ ...oxlintRecommended.rules, ...oxlintRecommended.overrides[0].rules }, oxlintAi.rules, oxlintNodeExtended.rules];
    for (const configured of [...others, ...oxlintOthers]) {
      assert.deepEqual(Object.keys(configured).filter((name) => name.includes(`/${NODE_RULE_PREFIX}`)), []);
    }
  });

  it("the Oxlint node config has the same rules as ESLint's, through this plugin's jsPlugins entry", () => {
    assert.deepEqual(oxlintNode.rules, plugin.configs.node[0].rules);
    assert.deepEqual(oxlintNode.jsPlugins, [{ name: PLUGIN_PREFIX, specifier: `${PACKAGE_NAME}/plugin` }]);
  });

  it("node loads no plugin but this one, so it adds no peer dependency", () => {
    const plugins = plugin.configs.node.flatMap((entry) => Object.keys(entry.plugins ?? {}));
    assert.deepEqual(plugins, [PLUGIN_PREFIX]);
  });

  it("node-extended turns on n/handle-callback-err with ^(err|error)$, and leaves out n/no-process-exit and n/no-sync", () => {
    const configured = rulesOf(plugin.configs["node-extended"]);
    assert.deepEqual(configured, { "n/handle-callback-err": ["error", "^(err|error)$"] });
    assert.deepEqual(plugin.configs["node-extended"].flatMap((entry) => Object.keys(entry.plugins ?? {})), ["n"]);
    assert.deepEqual(plugin.configs["node-extended"][0].files, plugin.configs.node[0].files);
    assert.equal(plugin.configs["node-extended"], plugin.configs["node-extended"], "node-extended is built once, like the other configs");
  });

  it("the Oxlint node-extended config runs the rule natively, with the same pattern, and loads no JS plugin", () => {
    assert.deepEqual(oxlintNodeExtended, { plugins: ["node"], rules: { "node/handle-callback-err": ["error", "^(err|error)$"] } });
  });

  it("the Oxlint config has the same custom rules as ESLint's recommended", () => {
    const eslint = Object.keys(rulesOf(plugin.configs.recommended)).filter((name) => name.startsWith("clean-code-book/"));
    const oxlint = Object.keys({ ...oxlintRecommended.rules, ...oxlintRecommended.overrides[0].rules }).filter((name) => name.startsWith("clean-code-book/"));
    assert.deepEqual(oxlint.sort(), eslint.sort());
    assert.equal(eslint.length, SYNTAX_RULES.length + TEST_FILE_RULES.length);
  });
});

describe("the rule docs and messages", () => {
  for (const [name, rule] of Object.entries(rules).filter(([ruleName]) => isAiRule(ruleName))) {
    it(`${name} has its doc page under docs/rules/ai/, with the ai sections`, () => {
      const path = join(ROOT, "docs", "rules", "ai", `${name}.md`);
      assert.ok(existsSync(path), `docs/rules/ai/${name}.md is missing`);
      const doc = readFileSync(path, "utf8");
      assert.match(doc, new RegExp(`^# clean-code-book/${name}\\n`));
      assert.match(doc, /\n- \*\*Config:\*\* `ai`\n/);
      assert.match(doc, /\n## The AI pattern\n/);
      assert.match(doc, /\n\*\*Language basis:\*\* (universal|JS\/TS-specific)\. \S/);
      assert.match(doc, /\n## What it reports\n/);
      assert.match(doc, /\n## Examples\n/);
      assert.match(doc, /\n## Why there is no autofix\n/);
      assert.equal(rule.meta.fixable, undefined);
      assert.equal(rule.meta.docs.url, `https://unpkg.com/${PACKAGE_NAME}/docs/rules/ai/${name}.md`);
    });

    it(`${name}: every message names the problem, the AI pattern and its harm, and the refactor`, () => {
      for (const message of Object.values(rule.meta.messages)) {
        assert.match(message, /^.+ AI pattern AI-\d{2}, [^:]+: .+ Refactor: .+$/s);
      }
    });
  }

  it("ai-no-ceremonial-catch's doc explains where it departs from the book's Java delete() example", () => {
    const doc = readFileSync(join(ROOT, "docs", "rules", "ai", "ai-no-ceremonial-catch.md"), "utf8");
    const start = doc.indexOf("\n## Where this departs from the book\n");
    assert.notEqual(start, -1, "the doc has no \"Where this departs from the book\" section");
    const section = doc.slice(start);
    assert.match(section, /delete\(\)/);
    assert.match(section, /Java/);
    assert.match(section, /checked exception/);
  });

  for (const [name, rule] of Object.entries(rules).filter(([ruleName]) => isNodeRule(ruleName))) {
    it(`${name} has its doc page under docs/rules/node/, quoting its Node book`, () => {
      const path = join(ROOT, docPath(name));
      assert.ok(existsSync(path), `${docPath(name)} is missing`);
      const doc = readFileSync(path, "utf8");
      assert.match(doc, new RegExp(`^# clean-code-book/${name}\\n`));
      assert.match(doc, /\n- \*\*Config:\*\* `node`\n/);
      assert.match(doc, /\n- \*\*Catalog entry:\*\* NODE-\d{2} in /);
      assert.match(doc, /\n## What the book says\n\n> "/);
      assert.match(doc, /\n## What it reports\n/);
      assert.match(doc, /\n## Examples\n/);
      assert.match(doc, /\n## Why there is no autofix\n/);
      assert.equal(rule.meta.fixable, undefined);
      assert.equal(rule.meta.docs.url, `https://unpkg.com/${PACKAGE_NAME}/${docPath(name)}`);
    });

    it(`${name}: every message names the problem, the Node book's passage and the refactor`, () => {
      for (const message of Object.values(rule.meta.messages)) {
        assert.match(message, /^.+ (Distributed Systems with Node\.js|JavaScript: The Definitive Guide), § [^:]+: ".+" Refactor: .+$/s);
      }
    });

    it(`${name}: its passage is copied from its catalog entry`, () => {
      const { source } = rule.meta.docs;
      assert.ok(source, `${name} names no Node book source`);
      const start = nodeCatalog.indexOf(`\n#### ${source.entry} · `);
      assert.notEqual(start, -1, `docs/catalog-node.md has no entry ${source.entry}`);
      const entry = nodeCatalog.slice(start + 1).split(/\n#{2,4} /)[0];
      assert.match(entry, new RegExp(`\\*\\*Rule:\\*\\* \`${name}\``));
      assert.ok(entry.includes(source.passage), `${name}'s passage is not in ${source.entry}'s quote`);
    });
  }

  for (const [name, rule] of Object.entries(rules).filter(([ruleName]) => !isAiRule(ruleName) && !isNodeRule(ruleName))) {
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

  it("lists eslint-plugin-n as an optional peer dependency, and tests with it as a dev dependency", () => {
    assert.ok(pkg.peerDependencies["eslint-plugin-n"], "eslint-plugin-n is not a peer dependency");
    assert.deepEqual(pkg.peerDependenciesMeta["eslint-plugin-n"], { optional: true });
    assert.ok(pkg.devDependencies["eslint-plugin-n"], "eslint-plugin-n is not a dev dependency");
    assert.equal(pkg.dependencies?.["eslint-plugin-n"], undefined);
  });

  it("its README, rule docs and rule URLs carry no organisation branding", () => {
    const docFiles = readdirSync(join(ROOT, "docs", "rules"), { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile());
    const docs = docFiles.map((entry) => readFileSync(join(entry.parentPath, entry.name), "utf8"));
    assert.ok(docFiles.some((entry) => entry.parentPath.endsWith("ai")), "the ai rule docs are read too");
    assert.ok(docFiles.some((entry) => entry.parentPath.endsWith("node")), "the node rule docs are read too");
    for (const text of [readme, ...docs, ...Object.values(rules).map((rule) => rule.meta.docs.url)]) assert.doesNotMatch(text, /a11ign/i);
  });

  it("ships the build, every rule's doc page, the README and the LICENSE, and no source or tests", () => {
    const packed = spawnSync("npm", ["pack", "--dry-run", "--ignore-scripts", "--json"], { cwd: ROOT, encoding: "utf8" });
    assert.equal(packed.status, 0, packed.stderr);
    const files = new Set((JSON.parse(packed.stdout) as Array<{ files: Array<{ path: string }> }>)[0].files.map((file) => file.path));
    const expected = ["README.md", "LICENSE", "package.json", "dist/index.mjs", "dist/plugin.mjs", "dist/oxlint.mjs", "dist/index.d.ts"];
    for (const path of [...expected, ...Object.keys(rules).map(docPath)]) assert.ok(files.has(path), `${path} is not in the package`);
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
    ["In `ai`", AI_RULES],
    ["In `node`", NODE_RULES],
  ] as const;

  for (const [heading, configured] of SECTIONS) {
    it(`lists exactly the rules of "${heading}", each linked to its doc page, with its fix`, () => {
      const rows = readmeTable(heading);
      assert.deepEqual(rows.map((row) => row.name).sort(), [...configured].sort());
      for (const row of rows) {
        assert.equal(row.link, docPath(row.name));
        assert.ok(existsSync(join(ROOT, row.link)), row.link);
        assert.equal(row.fix === "no", !rules[row.name].meta.fixable, `${row.name}: the README says fix "${row.fix}"`);
      }
    });
  }

  it("lists exactly the rules node-extended turns on", () => {
    assert.deepEqual(readmeTable("In `node-extended`").map((row) => row.name), Object.keys(NODE_EXTENDED_RULES));
  });

  it("lists exactly the built-in rules recommended turns on", () => {
    const listed = readmeTable("Built-in rules").map((row) => row.name).sort();
    const builtIns = Object.keys(rulesOf(plugin.configs.recommended)).filter((name) => !name.startsWith(`${PLUGIN_PREFIX}/`));
    const expected = builtIns.filter((name) => name !== "@typescript-eslint/no-unused-vars").sort();
    assert.deepEqual(listed, expected);
  });
});
