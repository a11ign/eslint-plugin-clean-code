/**
 * The plugin against its catalog, its configs and its docs:
 * - every book rule in the catalog's rule table is registered and in the config its class names, and nothing else is;
 * - every `ai-` rule is in `docs/catalog-ai.md`'s rule table, with an entry that names its pattern, harm and Language basis,
 *   and is in the `ai` config of both linters and in no other config;
 * - every `ts-` rule is in `docs/catalog-typescript.md`'s rule table and in the `typescript` config of both linters only, with
 *   `eqeqeq`; its `third-party` rules are in `typescript-extended` and `typescript-extended-type-checked` only, with
 *   eslint-plugin-promise an optional peer dependency, and the type-checked one has no Oxlint export;
 * - every `node-` rule is in `docs/catalog-node.md`'s rule table and in the `node` config of both linters only, and its
 *   `third-party` rule is in `node-extended` only, with eslint-plugin-n an optional peer dependency;
 * - every `react-` rule is in `docs/catalog-react.md`'s rule table and in the `react` config of both linters only, on `.jsx` and
 *   `.tsx` files, and its `third-party` rules are in `react-extended` only, with the two React plugins optional peer dependencies;
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
import oxlintConfigs, {
  ai as oxlintAi, node as oxlintNode, nodeExtended as oxlintNodeExtended, react as oxlintReact, reactExtended as oxlintReactExtended, recommended as oxlintRecommended,
  typescript as oxlintTypescript, typescriptExtended as oxlintTypescriptExtended,
} from "../src/oxlint.ts";
import * as oxlintModule from "../src/oxlint.ts";
import {
  AI_RULES, BUILT_IN_RULES, NODE_EXTENDED_RULES, NODE_RULES, PLUGIN_PREFIX, REACT_RULES, SYNTAX_RULES, TEST_FILE_RULES, TYPE_CHECKED_RULES, TYPESCRIPT_RULES,
} from "../src/configs.ts";
import { AI_RULE_PREFIX, NODE_RULE_PREFIX, PACKAGE_NAME, REACT_RULE_PREFIX, TYPESCRIPT_RULE_PREFIX } from "../src/lib/define-rule.ts";
import { ROOT } from "./support.ts";

const catalog = readFileSync(join(ROOT, "docs", "catalog.md"), "utf8");
const aiCatalog = readFileSync(join(ROOT, "docs", "catalog-ai.md"), "utf8");
const typescriptCatalog = readFileSync(join(ROOT, "docs", "catalog-typescript.md"), "utf8");
const nodeCatalog = readFileSync(join(ROOT, "docs", "catalog-node.md"), "utf8");
const reactCatalog = readFileSync(join(ROOT, "docs", "catalog-react.md"), "utf8");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const readme = readFileSync(join(ROOT, "README.md"), "utf8");
const rules = plugin.rules as unknown as Record<string, { meta: { fixable?: string; messages: Record<string, string>; docs: { url: string; requiresTypeChecking: boolean; source?: { entry: string; passage: string } } } }>;
const isAiRule = (name: string) => name.startsWith(AI_RULE_PREFIX);
const isNodeRule = (name: string) => name.startsWith(NODE_RULE_PREFIX);
const isReactRule = (name: string) => name.startsWith(REACT_RULE_PREFIX);
const isTypescriptRule = (name: string) => name.startsWith(TYPESCRIPT_RULE_PREFIX);
const isLanguageRule = (name: string) => isTypescriptRule(name) || isNodeRule(name) || isReactRule(name);
const bookRuleNames = Object.keys(rules).filter((name) => !isAiRule(name) && !isLanguageRule(name));

/** The opt-in language configs whose rules quote a book of their own: the config, its rule folder, its catalog and its books. */
const LANGUAGES = [
  { config: "typescript", isRule: isTypescriptRule, catalog: typescriptCatalog, catalogFile: "docs/catalog-typescript.md", entry: /TS-\d{2}/, books: /Programming TypeScript|JavaScript: The Definitive Guide/ },
  { config: "node", isRule: isNodeRule, catalog: nodeCatalog, catalogFile: "docs/catalog-node.md", entry: /NODE-\d{2}/, books: /Distributed Systems with Node\.js|JavaScript: The Definitive Guide/ },
  { config: "react", isRule: isReactRule, catalog: reactCatalog, catalogFile: "docs/catalog-react.md", entry: /RCT-\d{2}/, books: /Learn React with TypeScript/ },
] as const;

/** Where a rule's doc page is, by the config its prefix names. */
function docPath(name: string): string {
  if (isAiRule(name)) return `docs/rules/ai/${name}.md`;
  const language = LANGUAGES.find((candidate) => candidate.isRule(name));
  return language ? `docs/rules/${language.config}/${name}.md` : `docs/rules/${name}.md`;
}

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

/** Every rule an Oxlint config turns on, at its top level and in its `overrides`. */
function oxlintRulesOf(config: { rules?: Record<string, unknown>; overrides?: Array<{ rules: Record<string, unknown> }> }): Record<string, unknown> {
  return Object.assign({}, config.rules ?? {}, ...(config.overrides ?? []).map((override) => override.rules));
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

/** The rows of a language catalog's "The rule set at a glance" table that name a rule. */
function languageTable(languageCatalog: string): Array<{ name: string; entry: string; config: string; ruleClass: string; fix: string }> {
  const section = languageCatalog.slice(languageCatalog.indexOf("## The rule set at a glance"), languageCatalog.indexOf("## Entries"));
  return section.split("\n").filter((line) => /^\| `/.test(line)).map((line) => {
    const [name, entry, config, ruleClass, fix] = tableCells(line);
    return { name: name.replaceAll("`", ""), entry, config, ruleClass, fix };
  });
}

describe("the typescript catalog", () => {
  const table = languageTable(typescriptCatalog);

  it("lists exactly the registered ts- rules, each a syntax rule in typescript with no fix", () => {
    const syntaxRows = table.filter((row) => row.ruleClass === "syntax");
    assert.deepEqual(syntaxRows.map((row) => row.name).sort(), Object.keys(rules).filter(isTypescriptRule).sort());
    for (const row of syntaxRows) {
      assert.equal(row.config, "typescript", row.name);
      assert.equal(row.fix, "no fix", row.name);
      assert.equal(rules[row.name].meta.fixable, undefined, `${row.name} should have no fix`);
      assert.equal(rules[row.name].meta.docs.requiresTypeChecking, false, `${row.name} should need no type information`);
    }
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
    for (const row of syntaxRows) {
      assert.equal(row.config, "node", row.name);
      assert.equal(row.fix, "no fix", row.name);
      assert.equal(rules[row.name].meta.fixable, undefined, `${row.name} should have no fix`);
      assert.equal(rules[row.name].meta.docs.requiresTypeChecking, false, `${row.name} should need no type information`);
    }
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
    for (const row of syntaxRows) {
      assert.equal(row.config, "react", row.name);
      assert.equal(row.fix, "no fix", row.name);
      assert.equal(rules[row.name].meta.fixable, undefined, `${row.name} should have no fix`);
      assert.equal(rules[row.name].meta.docs.requiresTypeChecking, false, `${row.name} should need no type information`);
    }
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
    const others = [
      "recommended", "recommended-type-checked", "typescript", "typescript-extended", "typescript-extended-type-checked", "node", "node-extended", "react", "react-extended",
    ] as const;
    for (const config of others.map((name) => plugin.configs[name])) {
      assert.deepEqual(Object.keys(rulesOf(config)).filter((name) => name.includes(`/${AI_RULE_PREFIX}`)), []);
    }
    const oxlint = {
      ...oxlintRecommended.rules, ...oxlintRecommended.overrides[0].rules, ...oxlintTypescript.rules, ...oxlintRulesOf(oxlintTypescriptExtended), ...oxlintNode.rules,
      ...oxlintNodeExtended.rules, ...oxlintRulesOf(oxlintReact), ...oxlintRulesOf(oxlintReactExtended),
    };
    assert.deepEqual(Object.keys(oxlint).filter((name) => name.includes(`/${AI_RULE_PREFIX}`)), []);
  });

  it("the Oxlint ai config has the same rules, and the same test-file exemptions, as ESLint's", () => {
    assert.deepEqual(oxlintAi.rules, plugin.configs.ai[0].rules);
    const eslintTests = plugin.configs.ai.find((entry) => entry.name === `${PLUGIN_PREFIX}/ai/tests`);
    assert.deepEqual(oxlintAi.overrides, [{ files: eslintTests?.files, rules: eslintTests?.rules }]);
  });

  it("typescript turns on exactly the ts- rules and eqeqeq \"always\", on every file, and they are in no other config of either linter", () => {
    const configured = plugin.configs.typescript.filter((entry) => entry.rules);
    assert.deepEqual(configured.map((entry) => entry.files), [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"]]);
    assert.deepEqual(rulesOf(plugin.configs.typescript), { eqeqeq: ["error", "always"], ...Object.fromEntries(TYPESCRIPT_RULES.map((name) => [`${PLUGIN_PREFIX}/${name}`, "error"])) });
    assert.deepEqual(Object.keys(rules).filter(isTypescriptRule).sort(), [...TYPESCRIPT_RULES].sort());
    const others = [plugin.configs.recommended, plugin.configs["recommended-type-checked"], plugin.configs.ai, plugin.configs.node, plugin.configs["node-extended"], plugin.configs.react, plugin.configs["react-extended"]].map(rulesOf);
    const oxlintOthers = [{ ...oxlintRecommended.rules, ...oxlintRecommended.overrides[0].rules }, oxlintAi.rules, oxlintNode.rules, oxlintNodeExtended.rules, oxlintRulesOf(oxlintReact), oxlintRulesOf(oxlintReactExtended)];
    for (const configured of [...others, ...oxlintOthers]) {
      assert.deepEqual(Object.keys(configured).filter((name) => name.includes(`/${TYPESCRIPT_RULE_PREFIX}`) || name === "eqeqeq"), []);
    }
  });

  it("typescript loads no plugin but this one, so it adds no peer dependency beyond typescript-eslint's parser", () => {
    assert.deepEqual(plugin.configs.typescript.flatMap((entry) => Object.keys(entry.plugins ?? {})), [PLUGIN_PREFIX]);
  });

  it("the typescript configs override no rule of recommended or recommended-type-checked", () => {
    const recommendedRules = Object.keys(rulesOf(plugin.configs["recommended-type-checked"]));
    const configs = [plugin.configs.typescript, plugin.configs["typescript-extended"], plugin.configs["typescript-extended-type-checked"]].map(rulesOf);
    for (const config of [...configs, oxlintTypescript.rules, oxlintRulesOf(oxlintTypescriptExtended)]) {
      assert.deepEqual(Object.keys(config).filter((name) => recommendedRules.includes(name)), []);
    }
  });

  it("the Oxlint typescript config has the same rules as ESLint's, through this plugin's jsPlugins entry", () => {
    assert.deepEqual(oxlintTypescript.rules, plugin.configs.typescript[0].rules);
    assert.deepEqual(oxlintTypescript.jsPlugins, [{ name: PLUGIN_PREFIX, specifier: `${PACKAGE_NAME}/plugin` }]);
  });

  it("typescript-extended turns on TS-01, TS-02, TS-03 and TS-13 on TypeScript files, and promise/prefer-catch on every file", () => {
    const byFiles = plugin.configs["typescript-extended"].map((entry) => [entry.files, entry.rules]);
    assert.deepEqual(byFiles, [
      [["**/*.{ts,mts,cts,tsx}"], {
        "@typescript-eslint/no-explicit-any": "error",
        "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "never" }],
        "@typescript-eslint/no-non-null-assertion": "error",
        "@typescript-eslint/triple-slash-reference": ["error", { path: "never", types: "prefer-import", lib: "never" }],
      }],
      [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], { "promise/prefer-catch": "error" }],
    ]);
    assert.deepEqual(plugin.configs["typescript-extended"].flatMap((entry) => Object.keys(entry.plugins ?? {})), ["@typescript-eslint", "promise"]);
    assert.equal(plugin.configs["typescript-extended"], plugin.configs["typescript-extended"], "typescript-extended is built once, like the other configs");
  });

  it("typescript-extended-type-checked is typescript-extended, plus TS-10 and TS-16 with the project service on", () => {
    const typeChecked = plugin.configs["typescript-extended-type-checked"];
    assert.deepEqual(typeChecked.slice(0, -1), plugin.configs["typescript-extended"]);
    const last = typeChecked.at(-1);
    assert.deepEqual(last?.files, ["**/*.{ts,mts,cts,tsx}"]);
    assert.deepEqual(last?.languageOptions, { parserOptions: { projectService: true } });
    assert.deepEqual(last?.rules, { "@typescript-eslint/no-floating-promises": "error", "@typescript-eslint/switch-exhaustiveness-check": "error" });
  });

  it("the Oxlint typescript-extended config runs the same five rules natively, with the same settings and files, and loads no JS plugin", () => {
    assert.deepEqual(oxlintTypescriptExtended, {
      plugins: ["typescript", "promise"],
      rules: { "promise/prefer-catch": "error" },
      overrides: [{
        files: ["**/*.{ts,mts,cts,tsx}"],
        rules: {
          "typescript/no-explicit-any": "error",
          "typescript/consistent-type-assertions": ["error", { assertionStyle: "never" }],
          "typescript/no-non-null-assertion": "error",
          "typescript/triple-slash-reference": ["error", { path: "never", types: "prefer-import", lib: "never" }],
        },
      }],
    });
  });

  it("Oxlint has no typescript-extended-type-checked export, as it has no recommended-type-checked one", () => {
    assert.deepEqual(Object.keys(oxlintConfigs), ["recommended", "ai", "typescript", "typescript-extended", "node", "node-extended", "react", "react-extended"]);
    assert.deepEqual(Object.keys(oxlintModule).filter((name) => /type.?checked/i.test(name)), []);
  });

  it("node turns on exactly the node- rules, and they are in no other config of either linter", () => {
    assert.deepEqual(Object.keys(rulesOf(plugin.configs.node)).sort(), NODE_RULES.map((name) => `${PLUGIN_PREFIX}/${name}`).sort());
    assert.deepEqual(Object.keys(rules).filter(isNodeRule).sort(), [...NODE_RULES].sort());
    const others = [plugin.configs.recommended, plugin.configs["recommended-type-checked"], plugin.configs.ai, plugin.configs.typescript, plugin.configs["typescript-extended"], plugin.configs["typescript-extended-type-checked"], plugin.configs["node-extended"], plugin.configs.react, plugin.configs["react-extended"]].map(rulesOf);
    const oxlintOthers = [{ ...oxlintRecommended.rules, ...oxlintRecommended.overrides[0].rules }, oxlintAi.rules, oxlintTypescript.rules, oxlintRulesOf(oxlintTypescriptExtended), oxlintNodeExtended.rules, oxlintRulesOf(oxlintReact), oxlintRulesOf(oxlintReactExtended)];
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

  it("react turns on exactly the react- rules, on .jsx and .tsx files only, and they are in no other config of either linter", () => {
    const configured = plugin.configs.react.filter((entry) => entry.rules);
    assert.deepEqual(configured.map((entry) => entry.files), [["**/*.{jsx,tsx}"]]);
    assert.deepEqual(Object.keys(rulesOf(plugin.configs.react)).sort(), REACT_RULES.map((name) => `${PLUGIN_PREFIX}/${name}`).sort());
    assert.deepEqual(Object.keys(rules).filter(isReactRule).sort(), [...REACT_RULES].sort());
    const others = [plugin.configs.recommended, plugin.configs["recommended-type-checked"], plugin.configs.ai, plugin.configs.typescript, plugin.configs["typescript-extended"], plugin.configs["typescript-extended-type-checked"], plugin.configs.node, plugin.configs["node-extended"], plugin.configs["react-extended"]].map(rulesOf);
    const oxlintOthers = [{ ...oxlintRecommended.rules, ...oxlintRecommended.overrides[0].rules }, oxlintAi.rules, oxlintTypescript.rules, oxlintRulesOf(oxlintTypescriptExtended), oxlintNode.rules, oxlintNodeExtended.rules, oxlintRulesOf(oxlintReactExtended)];
    for (const rulesConfigured of [...others, ...oxlintOthers]) {
      assert.deepEqual(Object.keys(rulesConfigured).filter((name) => name.includes(`/${REACT_RULE_PREFIX}`)), []);
    }
  });

  it("react overrides no rule of recommended, so max-lines-per-function keeps its 12 lines on components and hooks", () => {
    const recommendedRules = Object.keys(rulesOf(plugin.configs.recommended));
    for (const config of [rulesOf(plugin.configs.react), rulesOf(plugin.configs["react-extended"]), oxlintRulesOf(oxlintReact), oxlintRulesOf(oxlintReactExtended)]) {
      assert.deepEqual(Object.keys(config).filter((name) => recommendedRules.includes(name)), []);
    }
  });

  it("the Oxlint react config has the same rules as ESLint's, on the same files, through this plugin's jsPlugins entry", () => {
    assert.deepEqual(oxlintReact.overrides, [{ files: plugin.configs.react[0].files, rules: plugin.configs.react[0].rules }]);
    assert.deepEqual(oxlintReact.jsPlugins, [{ name: PLUGIN_PREFIX, specifier: `${PACKAGE_NAME}/plugin` }]);
  });

  it("react loads no plugin but this one, so it adds no peer dependency", () => {
    assert.deepEqual(plugin.configs.react.flatMap((entry) => Object.keys(entry.plugins ?? {})), [PLUGIN_PREFIX]);
  });

  it("react-extended turns on the hooks rules on components and use* hook files, and the list-key rules on .jsx and .tsx only", () => {
    const byFiles = plugin.configs["react-extended"].filter((entry) => entry.rules).map((entry) => [entry.files, entry.rules]);
    assert.deepEqual(byFiles, [
      [["**/*.{jsx,tsx}", "**/use*.{js,ts}"], { "react-hooks/rules-of-hooks": "error", "react-hooks/exhaustive-deps": "error" }],
      [["**/*.{jsx,tsx}"], { "react/jsx-key": "error", "react/no-array-index-key": "error" }],
    ]);
    assert.deepEqual(plugin.configs["react-extended"].flatMap((entry) => Object.keys(entry.plugins ?? {})), ["react-hooks", "react"]);
    assert.equal(plugin.configs["react-extended"], plugin.configs["react-extended"], "react-extended is built once, like the other configs");
  });

  it("the Oxlint react-extended config runs the same rules natively, on the same files, and loads no JS plugin", () => {
    assert.deepEqual(oxlintReactExtended, {
      overrides: [
        { files: ["**/*.{jsx,tsx}", "**/use*.{js,ts}"], plugins: ["react"], rules: { "react/rules-of-hooks": "error", "react/exhaustive-deps": "error" } },
        { files: ["**/*.{jsx,tsx}"], plugins: ["react"], rules: { "react/jsx-key": "error", "react/no-array-index-key": "error" } },
      ],
    });
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

  for (const language of LANGUAGES) {
    for (const [name, rule] of Object.entries(rules).filter(([ruleName]) => language.isRule(ruleName))) {
      it(`${name} has its doc page under docs/rules/${language.config}/, quoting its ${language.config} book`, () => {
        const path = join(ROOT, docPath(name));
        assert.ok(existsSync(path), `${docPath(name)} is missing`);
        const doc = readFileSync(path, "utf8");
        assert.match(doc, new RegExp(`^# clean-code-book/${name}\\n`));
        assert.match(doc, new RegExp(`\\n- \\*\\*Config:\\*\\* \`${language.config}\`\\n`));
        assert.match(doc, new RegExp(`\\n- \\*\\*Catalog entry:\\*\\* ${language.entry.source} in `));
        assert.match(doc, /\n## What the book says\n\n> "/);
        assert.match(doc, /\n## What it reports\n/);
        assert.match(doc, /\n## Examples\n/);
        assert.match(doc, /\n## Why there is no autofix\n/);
        assert.equal(rule.meta.fixable, undefined);
        assert.equal(rule.meta.docs.url, `https://unpkg.com/${PACKAGE_NAME}/${docPath(name)}`);
      });

      it(`${name}: every message names the problem, its ${language.config} book's passage and the refactor`, () => {
        for (const message of Object.values(rule.meta.messages)) {
          assert.match(message, new RegExp(`^.+ (${language.books.source}), § [^:]+: ".+" Refactor: .+$`, "s"));
        }
      });

      it(`${name}: its passage is copied from its catalog entry`, () => {
        const { source } = rule.meta.docs;
        assert.ok(source, `${name} names no ${language.config} book source`);
        const start = language.catalog.indexOf(`\n#### ${source.entry} · `);
        assert.notEqual(start, -1, `${language.catalogFile} has no entry ${source.entry}`);
        const entry = language.catalog.slice(start + 1).split(/\n#{2,4} /)[0];
        assert.match(entry, new RegExp(`\\*\\*Rule:\\*\\* \`${name}\``));
        assert.ok(entry.includes(source.passage), `${name}'s passage is not in ${source.entry}'s quote`);
      });
    }
  }

  for (const [name, rule] of Object.entries(rules).filter(([ruleName]) => !isAiRule(ruleName) && !isLanguageRule(ruleName))) {
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

  it("lists eslint-plugin-promise as an optional peer dependency, tests with it as a dev dependency, and keeps typescript-eslint optional", () => {
    assert.equal(pkg.peerDependencies["eslint-plugin-promise"], ">=7.2.0", "7.2.0 is the first version with prefer-catch");
    assert.deepEqual(pkg.peerDependenciesMeta["eslint-plugin-promise"], { optional: true });
    assert.ok(pkg.devDependencies["eslint-plugin-promise"], "eslint-plugin-promise is not a dev dependency");
    assert.equal(pkg.dependencies?.["eslint-plugin-promise"], undefined);
    assert.deepEqual(pkg.peerDependenciesMeta["typescript-eslint"], { optional: true });
  });

  it("lists eslint-plugin-react-hooks and eslint-plugin-react as optional peer dependencies, and tests with them as dev dependencies", () => {
    for (const name of ["eslint-plugin-react-hooks", "eslint-plugin-react"]) {
      assert.ok(pkg.peerDependencies[name], `${name} is not a peer dependency`);
      assert.deepEqual(pkg.peerDependenciesMeta[name], { optional: true });
      assert.ok(pkg.devDependencies[name], `${name} is not a dev dependency`);
      assert.equal(pkg.dependencies?.[name], undefined);
    }
    assert.equal(pkg.peerDependencies["eslint-plugin-react-hooks"], ">=6.0.0", "version 6 or later, as the catalog asks");
  });

  it("its README, rule docs and rule URLs carry no organisation branding", () => {
    const docFiles = readdirSync(join(ROOT, "docs", "rules"), { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile());
    const docs = docFiles.map((entry) => readFileSync(join(entry.parentPath, entry.name), "utf8"));
    assert.ok(docFiles.some((entry) => entry.parentPath.endsWith("ai")), "the ai rule docs are read too");
    assert.ok(docFiles.some((entry) => entry.parentPath.endsWith("typescript")), "the typescript rule docs are read too");
    assert.ok(docFiles.some((entry) => entry.parentPath.endsWith("node")), "the node rule docs are read too");
    assert.ok(docFiles.some((entry) => entry.parentPath.endsWith("react")), "the react rule docs are read too");
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

describe("the ADRs", () => {
  const ADR_DIR = join(ROOT, "docs", "adr");
  const adrFiles = readdirSync(ADR_DIR).sort();
  /** Every file outside `docs/adr/` that may cite an ADR: the sources, the docs and the two top-level guides. */
  const citing = [
    ...readdirSync(join(ROOT, "src"), { recursive: true, withFileTypes: true }),
    ...readdirSync(join(ROOT, "docs"), { recursive: true, withFileTypes: true }).filter((entry) => !entry.parentPath.startsWith(ADR_DIR)),
  ].filter((entry) => entry.isFile() && /\.(ts|md)$/.test(entry.name)).map((entry) => join(entry.parentPath, entry.name));
  const texts = [...citing, join(ROOT, "README.md"), join(ROOT, "CONTRIBUTING.md")].map((path) => ({ path, text: readFileSync(path, "utf8") }));

  it("docs/adr/ holds ADRs 0001 to 0004, numbered by date", () => {
    assert.deepEqual(adrFiles, [
      "0001-own-plugin-replaces-george2f.md",
      "0002-eslint-and-oxlint-shared-rule-api.md",
      "0003-ai-config-separate-from-book-rules.md",
      "0004-language-configs-with-extended-companions.md",
    ]);
  });

  it("every ADR cited in the repository is a file in docs/adr/, and no citation names another ticket's numbering", () => {
    const numbers = new Set(adrFiles.map((name) => name.slice(0, 4)));
    for (const { path, text } of texts) {
      for (const [, number] of text.matchAll(/ADR (\d{4})/g)) assert.ok(numbers.has(number), `${path} cites ADR ${number}`);
      assert.doesNotMatch(text, /ADR \d{4} of A11-/, path);
    }
  });

  it("the ai config cites ADR 0003, and the language configs ADR 0004", () => {
    const cited = (pattern: RegExp) => texts.filter(({ text }) => pattern.test(text)).map(({ path }) => path.slice(ROOT.length));
    assert.deepEqual(cited(/ADR 0001/), []);
    for (const file of ["docs/catalog-ai.md", "CONTRIBUTING.md", "src/configs.ts", "src/index.ts", "src/lib/define-rule.ts"]) assert.ok(cited(/ADR 0003/).includes(file), file);
    for (const file of ["docs/catalog-typescript.md", "docs/catalog-node.md", "docs/catalog-react.md"]) assert.ok(cited(/ADR 0004/).includes(file), file);
  });

  it("every link to an ADR resolves", () => {
    for (const { path, text } of texts) {
      for (const [, target] of text.matchAll(/\]\(((?:\.\.\/)*(?:docs\/)?adr\/[^)]+)\)/g)) {
        assert.ok(existsSync(join(path, "..", target)), `${path} links ${target}`);
      }
    }
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
    ["In `typescript`", TYPESCRIPT_RULES],
    ["In `node`", NODE_RULES],
    ["In `react`", REACT_RULES],
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
