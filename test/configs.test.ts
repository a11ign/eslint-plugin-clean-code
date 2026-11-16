/**
 * The plugin's configs, under ESLint and Oxlint:
 * - every rule is `"error"`, and the book's stated thresholds are used; type-aware rules are only in `recommended-type-checked`;
 * - the `ai`, `typescript`, `node` and `react` configs turn on exactly their own rules, which are in no other config of either
 *   linter; their `-extended` companions turn on the third-party rules, and Oxlint runs the same rules, natively where it can;
 * - `typescript-extended-type-checked` has no Oxlint export;
 * - `jsdoc` turns on `eslint-plugin-jsdoc`'s rules one by one and its own `jsdoc-` rule, which no other config has; Oxlint runs the
 *   two third-party rules it has natively, and the `jsdoc-` rule through `jsPlugins`.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Linter } from "eslint";
import plugin from "../src/index.ts";
import oxlintConfigs, {
  ai as oxlintAi, jsdoc as oxlintJsdoc, node as oxlintNode, nodeExtended as oxlintNodeExtended, react as oxlintReact, reactExtended as oxlintReactExtended, recommended as oxlintRecommended,
  typescript as oxlintTypescript, typescriptExtended as oxlintTypescriptExtended,
} from "../src/oxlint.ts";
import * as oxlintModule from "../src/oxlint.ts";
import { AI_RULES, JSDOC_RULES, JSDOC_SYNTAX_RULES, JSDOC_TS_RULES, NODE_RULES, PLUGIN_PREFIX, REACT_RULES, SYNTAX_RULES, TEST_FILE_RULES, TYPE_CHECKED_RULES, TYPESCRIPT_RULES } from "../src/configs.ts";
import { AI_RULE_PREFIX, JSDOC_RULE_PREFIX, NODE_RULE_PREFIX, PACKAGE_NAME, REACT_RULE_PREFIX, TYPESCRIPT_RULE_PREFIX } from "../src/lib/define-rule.ts";
import { isAiRule, isNodeRule, isReactRule, isTypescriptRule, rules, rulesOf } from "./plugin-support.ts";

/** Every rule the Oxlint `config` turns on, at its top level and in its `overrides`. */
function oxlintRulesOf(config: { rules?: Record<string, unknown>; overrides?: Array<{ rules: Record<string, unknown> }> }): Record<string, unknown> {
  return Object.assign({}, config.rules ?? {}, ...(config.overrides ?? []).map((override) => override.rules));
}

/** Each rule setting of each ESLint config, with the config's name. */
function ruleSettings(): Array<{ name: string; rule: string; setting: unknown }> {
  const configs = Object.entries(plugin.configs as Record<string, Linter.Config[]>);
  return configs.flatMap(([name, config]) => Object.entries(rulesOf(config)).map(([rule, setting]) => ({ name, rule, setting })));
}

function severity(setting: unknown): unknown {
  return Array.isArray(setting) ? setting[0] : setting;
}

describe("the configs", () => {
  it("every rule in every config is an error", () => {
    for (const { name, rule, setting } of ruleSettings().filter((entry) => severity(entry.setting) !== "off")) {
      assert.equal(severity(setting), "error", `${name}: ${rule}`);
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
      "recommended", "recommended-type-checked", "typescript", "typescript-extended", "typescript-extended-type-checked", "node", "node-extended", "react", "react-extended", "jsdoc",
    ] as const;
    for (const config of others.map((name) => plugin.configs[name])) {
      assert.deepEqual(Object.keys(rulesOf(config)).filter((name) => name.includes(`/${AI_RULE_PREFIX}`)), []);
    }
    const oxlint = {
      ...oxlintRecommended.rules, ...oxlintRecommended.overrides[0].rules, ...oxlintTypescript.rules, ...oxlintRulesOf(oxlintTypescriptExtended), ...oxlintNode.rules,
      ...oxlintNodeExtended.rules, ...oxlintRulesOf(oxlintReact), ...oxlintRulesOf(oxlintReactExtended), ...oxlintJsdoc.rules,
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
    const others = [plugin.configs.recommended, plugin.configs["recommended-type-checked"], plugin.configs.ai, plugin.configs.node, plugin.configs["node-extended"], plugin.configs.react, plugin.configs["react-extended"], plugin.configs.jsdoc].map(rulesOf);
    const oxlintOthers = [{ ...oxlintRecommended.rules, ...oxlintRecommended.overrides[0].rules }, oxlintAi.rules, oxlintNode.rules, oxlintNodeExtended.rules, oxlintRulesOf(oxlintReact), oxlintRulesOf(oxlintReactExtended), oxlintJsdoc.rules];
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
    assert.deepEqual(Object.keys(oxlintConfigs), ["recommended", "ai", "typescript", "typescript-extended", "node", "node-extended", "react", "react-extended", "jsdoc"]);
    assert.deepEqual(Object.keys(oxlintModule).filter((name) => /type.?checked/i.test(name)), []);
  });

  it("node turns on exactly the node- rules, and they are in no other config of either linter", () => {
    assert.deepEqual(Object.keys(rulesOf(plugin.configs.node)).sort(), NODE_RULES.map((name) => `${PLUGIN_PREFIX}/${name}`).sort());
    assert.deepEqual(Object.keys(rules).filter(isNodeRule).sort(), [...NODE_RULES].sort());
    const others = [plugin.configs.recommended, plugin.configs["recommended-type-checked"], plugin.configs.ai, plugin.configs.typescript, plugin.configs["typescript-extended"], plugin.configs["typescript-extended-type-checked"], plugin.configs["node-extended"], plugin.configs.react, plugin.configs["react-extended"], plugin.configs.jsdoc].map(rulesOf);
    const oxlintOthers = [{ ...oxlintRecommended.rules, ...oxlintRecommended.overrides[0].rules }, oxlintAi.rules, oxlintTypescript.rules, oxlintRulesOf(oxlintTypescriptExtended), oxlintNodeExtended.rules, oxlintRulesOf(oxlintReact), oxlintRulesOf(oxlintReactExtended), oxlintJsdoc.rules];
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
    const others = [plugin.configs.recommended, plugin.configs["recommended-type-checked"], plugin.configs.ai, plugin.configs.typescript, plugin.configs["typescript-extended"], plugin.configs["typescript-extended-type-checked"], plugin.configs.node, plugin.configs["node-extended"], plugin.configs["react-extended"], plugin.configs.jsdoc].map(rulesOf);
    const oxlintOthers = [{ ...oxlintRecommended.rules, ...oxlintRecommended.overrides[0].rules }, oxlintAi.rules, oxlintTypescript.rules, oxlintRulesOf(oxlintTypescriptExtended), oxlintNode.rules, oxlintNodeExtended.rules, oxlintRulesOf(oxlintReactExtended), oxlintJsdoc.rules];
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

  it("jsdoc turns on check-param-names, check-tag-names, empty-tags and jsdoc-names-every-parameter on every file, and no-types on TypeScript files only", () => {
    const byFiles = plugin.configs.jsdoc.map((entry) => [entry.files, entry.rules]);
    assert.deepEqual(byFiles, [
      [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], {
        "jsdoc/check-param-names": "error", "jsdoc/check-tag-names": "error", "jsdoc/empty-tags": "error", "clean-code-book/jsdoc-names-every-parameter": "error",
      }],
      [["**/*.{ts,mts,cts,tsx}"], { "jsdoc/no-types": "error" }],
    ]);
    assert.deepEqual(plugin.configs.jsdoc.flatMap((entry) => Object.keys(entry.plugins ?? {})), ["jsdoc", PLUGIN_PREFIX]);
    assert.equal(plugin.configs.jsdoc[1].languageOptions?.parser, plugin.configs.typescript[1].languageOptions?.parser, "TypeScript files get typescript-eslint's parser");
    assert.equal(plugin.configs.jsdoc, plugin.configs.jsdoc, "jsdoc is built once, like the other configs");
  });

  it("jsdoc's rules are in no other config of either linter, and it overrides no rule of recommended", () => {
    const jsdocRules = [...[...JSDOC_RULES, ...JSDOC_TS_RULES].map((name) => `jsdoc/${name}`), ...JSDOC_SYNTAX_RULES.map((name) => `${PLUGIN_PREFIX}/${name}`)];
    assert.deepEqual(Object.keys(rulesOf(plugin.configs.jsdoc)).sort(), [...jsdocRules].sort());
    const others = [
      "recommended", "recommended-type-checked", "ai", "typescript", "typescript-extended", "typescript-extended-type-checked", "node", "node-extended", "react", "react-extended",
    ] as const;
    const oxlintOthers = [
      { ...oxlintRecommended.rules, ...oxlintRecommended.overrides[0].rules }, oxlintAi.rules, oxlintTypescript.rules, oxlintRulesOf(oxlintTypescriptExtended), oxlintNode.rules,
      oxlintNodeExtended.rules, oxlintRulesOf(oxlintReact), oxlintRulesOf(oxlintReactExtended),
    ];
    for (const configured of [...others.map((name) => rulesOf(plugin.configs[name])), ...oxlintOthers]) {
      assert.deepEqual(Object.keys(configured).filter((name) => name.startsWith("jsdoc/") || name.includes(`/${JSDOC_RULE_PREFIX}`)), []);
    }
  });

  it("the Oxlint jsdoc config runs check-tag-names and empty-tags natively, and jsdoc-names-every-parameter through this plugin's jsPlugins entry", () => {
    assert.deepEqual(oxlintJsdoc, {
      plugins: ["jsdoc"],
      jsPlugins: [{ name: PLUGIN_PREFIX, specifier: `${PACKAGE_NAME}/plugin` }],
      rules: { "jsdoc/check-tag-names": "error", "jsdoc/empty-tags": "error", "clean-code-book/jsdoc-names-every-parameter": "error" },
    });
  });

  it("the Oxlint config has the same custom rules as ESLint's recommended", () => {
    const eslint = Object.keys(rulesOf(plugin.configs.recommended)).filter((name) => name.startsWith("clean-code-book/"));
    const oxlint = Object.keys({ ...oxlintRecommended.rules, ...oxlintRecommended.overrides[0].rules }).filter((name) => name.startsWith("clean-code-book/"));
    assert.deepEqual(oxlint.sort(), eslint.sort());
    assert.equal(eslint.length, SYNTAX_RULES.length + TEST_FILE_RULES.length);
  });
});
