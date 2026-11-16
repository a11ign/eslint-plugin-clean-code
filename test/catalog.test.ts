/**
 * The plugin against its catalogs:
 * - every book rule in the catalog's rule table is registered and in the config its class names, and nothing else is; a rule
 *   the table marks as fixed has a fix;
 * - every `ai-` rule is in `docs/catalog-ai.md`'s rule table, with an entry that names its pattern, harm and Language basis;
 * - every `ts-`, `node-` and `react-` rule is in its language catalog's rule table, a syntax rule in its config with no fix,
 *   and each catalog's `third-party` rows are the rules of its extended configs;
 * - the `jsdoc` catalog's `third-party` rows and its `syntax` row are exactly the rules of the `jsdoc` config;
 * - the book's catalog names no rule of the other catalogs.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import plugin from "../src/index.ts";
import { BUILT_IN_RULES, JSDOC_RULES, JSDOC_SYNTAX_RULES, JSDOC_TS_RULES, NODE_EXTENDED_RULES, PLUGIN_PREFIX, TYPESCRIPT_RULES } from "../src/configs.ts";
import {
  aiCatalog, catalog, isAiRule, isJsdocRule, isLanguageRule, isNodeRule, isReactRule, isTypescriptRule, jsdocCatalog, nodeCatalog, reactCatalog, rules, rulesOf, tableCells, typescriptCatalog,
} from "./plugin-support.ts";

const bookRuleNames = Object.keys(rules).filter((name) => !isAiRule(name) && !isLanguageRule(name));

interface TableRow {
  names: string[];
  config: string;
  fix: string;
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

/** The rule names in `docs/catalog-ai.md`'s "The rule set at a glance" table, with each row's Entry and Fix cells. */
function aiTable(): Array<{ name: string; entry: string; fix: string }> {
  const section = aiCatalog.slice(aiCatalog.indexOf("## The rule set at a glance"), aiCatalog.indexOf("## Entries"));
  return section.split("\n").filter((line) => /^\| `/.test(line)).map((line) => {
    const [name, entry, , fix] = tableCells(line);
    return { name: name.replaceAll("`", ""), entry, fix };
  });
}

/** The rows of the "The rule set at a glance" table in `languageCatalog` that name a rule. */
function languageTable(languageCatalog: string): Array<{ name: string; entry: string; config: string; ruleClass: string; fix: string }> {
  const section = languageCatalog.slice(languageCatalog.indexOf("## The rule set at a glance"), languageCatalog.indexOf("## Entries"));
  return section.split("\n").filter((line) => /^\| `/.test(line)).map((line) => {
    const [name, entry, config, ruleClass, fix] = tableCells(line);
    return { name: name.replaceAll("`", ""), entry, config, ruleClass, fix };
  });
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
    const configByRule = customRows.flatMap((row) => row.names.map((name) => ({ name, config: row.config })));
    for (const { name, config } of configByRule) {
      const key = `clean-code-book/${name}`;
      if (config === "recommended-type-checked" && !(key in recommended)) assertTypeChecked(name, typeChecked);
      else assertInRecommended(name, recommended);
    }
  });

  it("a rule the table marks as fixed has a fix, and a rule marked 'no fix' has none", () => {
    for (const row of customRows) assertFixAsTheTableSays(row);
  });
});

describe("the ai catalog", () => {
  it("lists exactly the registered ai- rules, each with no fix", () => {
    const table = aiTable();
    assert.deepEqual(table.map((row) => row.name).sort(), Object.keys(rules).filter(isAiRule).sort());
    for (const row of table) assertNoFix(row);
  });

  it("each rule has an entry that names the AI pattern, its harm and its Language basis", () => {
    for (const row of aiTable()) assertAiEntry(row);
  });

  it("leaves the book's catalog alone: it names no ai- rule", () => {
    assert.doesNotMatch(catalog, /`ai-/);
  });
});

describe("the typescript catalog", () => {
  const table = languageTable(typescriptCatalog);

  it("lists exactly the registered ts- rules, each a syntax rule in typescript with no fix", () => {
    const syntaxRows = table.filter((row) => row.ruleClass === "syntax");
    assert.deepEqual(syntaxRows.map((row) => row.name).sort(), Object.keys(rules).filter(isTypescriptRule).sort());
    for (const row of syntaxRows) assertSyntaxRuleWithoutFix(row, "typescript");
  });

  it("its built-in row is in typescript, and typescript has no other rule but the ts- rules", () => {
    const builtIn = table.filter((row) => row.ruleClass === "built-in");
    assert.deepEqual(builtIn.map((row) => [row.name, row.config]), [["eqeqeq", "typescript"]]);
    const expected = [...builtIn.map((row) => row.name), ...TYPESCRIPT_RULES.map((name) => `${PLUGIN_PREFIX}/${name}`)];
    assert.deepEqual(Object.keys(rulesOf(plugin.configs.typescript)).sort(), expected.sort());
  });

  it("each third-party row is in the extended config it names, and each extended config has exactly the rules its rows name", () => {
    const thirdParty = table.filter((row) => row.ruleClass === "third-party");
    const named = (config: string) => thirdParty.filter((row) => row.config === config).map((row) => row.name);
    assert.deepEqual([...new Set(thirdParty.map((row) => row.config))].sort(), ["typescript-extended", "typescript-extended-type-checked"]);
    assert.deepEqual(Object.keys(rulesOf(plugin.configs["typescript-extended"])).sort(), named("typescript-extended").sort());
    const typeChecked = [...named("typescript-extended"), ...named("typescript-extended-type-checked")];
    assert.deepEqual(Object.keys(rulesOf(plugin.configs["typescript-extended-type-checked"])).sort(), typeChecked.sort());
  });

  it("leaves the book's catalog alone: it names no ts- rule", () => {
    assert.doesNotMatch(catalog, /`ts-/);
  });
});

describe("the node catalog", () => {
  it("lists exactly the registered node- rules, each a syntax rule in node with no fix", () => {
    const syntaxRows = languageTable(nodeCatalog).filter((row) => row.ruleClass === "syntax");
    assert.deepEqual(syntaxRows.map((row) => row.name).sort(), Object.keys(rules).filter(isNodeRule).sort());
    for (const row of syntaxRows) assertSyntaxRuleWithoutFix(row, "node");
  });

  it("each third-party row is in node-extended, and node-extended has no rule the table does not name", () => {
    const thirdParty = languageTable(nodeCatalog).filter((row) => row.ruleClass === "third-party");
    assert.deepEqual(thirdParty.map((row) => row.config), ["node-extended"]);
    assert.deepEqual(Object.keys(NODE_EXTENDED_RULES), thirdParty.map((row) => row.name));
  });

  it("leaves the book's catalog alone: it names no node- rule", () => {
    assert.doesNotMatch(catalog, /`node-/);
  });
});

describe("the react catalog", () => {
  it("lists exactly the registered react- rules, each a syntax rule in react with no fix", () => {
    const syntaxRows = languageTable(reactCatalog).filter((row) => row.ruleClass === "syntax");
    assert.deepEqual(syntaxRows.map((row) => row.name).sort(), Object.keys(rules).filter(isReactRule).sort());
    for (const row of syntaxRows) assertSyntaxRuleWithoutFix(row, "react");
  });

  it("each third-party row is in react-extended, and react-extended has exactly the rules the table names", () => {
    const thirdParty = languageTable(reactCatalog).filter((row) => row.ruleClass === "third-party");
    assert.deepEqual([...new Set(thirdParty.map((row) => row.config))], ["react-extended"]);
    assert.deepEqual(Object.keys(rulesOf(plugin.configs["react-extended"])).sort(), thirdParty.map((row) => row.name).sort());
  });

  it("leaves the book's catalog alone: it names no react- rule", () => {
    assert.doesNotMatch(catalog, /`react-/);
  });
});

describe("the jsdoc catalog", () => {
  const table = languageTable(jsdocCatalog);

  it("every row is a rule in jsdoc, third-party or syntax, and jsdoc has exactly the rules the table names", () => {
    assert.deepEqual([...new Set(table.map((row) => [row.config, row.ruleClass].join(" ")))], ["jsdoc third-party", "jsdoc syntax"]);
    assert.deepEqual(table.map((row) => row.entry), ["DOC-01", "DOC-02", "DOC-03", "DOC-04", "DOC-05"]);
    const thirdParty = table.filter((row) => row.ruleClass === "third-party").map((row) => row.name);
    assert.deepEqual([...JSDOC_RULES, ...JSDOC_TS_RULES].map((name) => `jsdoc/${name}`).sort(), [...thirdParty].sort());
    const configured = [...thirdParty, ...JSDOC_SYNTAX_RULES.map((name) => `${PLUGIN_PREFIX}/${name}`)];
    assert.deepEqual(Object.keys(rulesOf(plugin.configs.jsdoc)).sort(), configured.sort());
  });

  it("lists exactly the registered jsdoc- rules as syntax rows, each in jsdoc with no fix", () => {
    const syntaxRows = table.filter((row) => row.ruleClass === "syntax");
    assert.deepEqual(syntaxRows.map((row) => row.name).sort(), Object.keys(rules).filter(isJsdocRule).sort());
    assert.deepEqual(syntaxRows.map((row) => row.name).sort(), [...JSDOC_SYNTAX_RULES].sort());
    for (const row of syntaxRows) assertSyntaxRuleWithoutFix(row, "jsdoc");
  });

  it("leaves the book's catalog alone: it names no jsdoc- rule", () => {
    assert.doesNotMatch(catalog, /`jsdoc-/);
  });

  it("quotes the book's passage on document comments, and cites ADR 0004 for why jsdoc is not in recommended", () => {
    assert.match(jsdocCatalog, /Document comments can be just as misleading, nonlocal, and dishonest as any other kind of comment\./);
    assert.match(jsdocCatalog, /ADR 0004/);
  });
});

function assertTypeChecked(name: string, typeChecked: Record<string, unknown>): void {
  assert.ok(rules[name].meta.docs.requiresTypeChecking, `${name} should need type information`);
  assert.ok(`clean-code-book/${name}` in typeChecked, `${name} is not in recommended-type-checked`);
}

function assertInRecommended(name: string, recommended: Record<string, unknown>): void {
  assert.ok(`clean-code-book/${name}` in recommended, `${name} is not in recommended`);
  assert.ok(!rules[name].meta.docs.requiresTypeChecking, `${name} needs types but is in recommended`);
}

function assertFixAsTheTableSays(row: TableRow): void {
  assert.match(row.fix, /^(no fix|\*\*fix\*\*.*)$/, `${row.names.join(", ")}: the Fix cell reads "${row.fix}"`);
  for (const name of row.names) assertFixAsTheCellSays(name, row.fix);
}

function assertFixAsTheCellSays(name: string, fix: string): void {
  if (fix === "no fix") assert.equal(rules[name].meta.fixable, undefined, `${name} should have no fix`);
  else if (fix.includes("fix")) assert.equal(rules[name].meta.fixable, "code", `${name} should have a fix`);
}

/** The ai catalog has an `entry` for the row's rule `name`, naming its AI pattern, its harm and its Language basis. */
function assertAiEntry({ name, entry }: { name: string; entry: string }): void {
  const start = aiCatalog.indexOf(`\n#### ${entry} · `);
  assert.notEqual(start, -1, `docs/catalog-ai.md has no entry ${entry} for ${name}`);
  const body = aiCatalog.slice(start + 1).split(/\n#{2,4} /)[0];
  assert.match(body, new RegExp(`\\*\\*Rule:\\*\\* \`${name}\``), `${entry} names ${name}`);
  assert.match(body, /\n- \*\*AI pattern:\*\* \S/, `${entry} has an AI pattern line`);
  assert.match(body, /\n- \*\*Harm:\*\* \S/, `${entry} has a Harm line`);
  assert.match(body, /\n- \*\*Language basis:\*\* (universal|JS\/TS-specific)\. \S/, `${entry} has a Language basis line`);
}

/** The rule of `row` is in `config`, with no fix, and needs no type information. */
function assertSyntaxRuleWithoutFix(row: { name: string; config: string; fix: string }, config: string): void {
  assert.equal(row.config, config, row.name);
  assertNoFix(row);
  assert.equal(rules[row.name].meta.docs.requiresTypeChecking, false, `${row.name} should need no type information`);
}

/** `row` says "no fix", and its rule has none. */
function assertNoFix(row: { name: string; fix: string }): void {
  assert.equal(row.fix, "no fix", row.name);
  assert.equal(rules[row.name].meta.fixable, undefined, `${row.name} should have no fix`);
}
