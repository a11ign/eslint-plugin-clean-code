/**
 * The plugin's rule docs and messages:
 * - every rule has its doc page, with "Why there is no autofix" exactly when it has no fix;
 * - every message names the problem, the book passage (for an `ai` rule, the AI pattern and its harm; for a language rule, its
 *   own book's passage, copied from its catalog entry) and the refactor.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PACKAGE_NAME } from "../src/lib/define-rule.ts";
import { LANGUAGES, docPath, isAiRule, isLanguageRule, rules } from "./plugin-support.ts";
import { ROOT } from "./support.ts";

type Rule = (typeof rules)[string];

/** A rule of one of the opt-in language configs, with its language. */
interface LanguageRule {
  language: (typeof LANGUAGES)[number];
  name: string;
  rule: Rule;
}

function languageRules(): LanguageRule[] {
  return LANGUAGES.flatMap((language) => Object.entries(rules).filter(([ruleName]) => language.isRule(ruleName)).map(([name, rule]) => ({ language, name, rule })));
}

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

  for (const languageRule of languageRules()) testLanguageRule(languageRule);

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

/** The tests of a language rule's doc page, its messages and its passage. */
function testLanguageRule({ language, name, rule }: LanguageRule): void {
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
