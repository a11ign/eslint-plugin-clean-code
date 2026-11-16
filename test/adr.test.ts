/**
 * The ADRs: `docs/adr/` holds them numbered by date, and every ADR the repository cites or links is one of them.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./support.ts";

const ADR_DIR = join(ROOT, "docs", "adr");

/** Every file outside `docs/adr/` that may cite an ADR: the sources, the docs and the two top-level guides. */
function citingFiles(): string[] {
  const sourcesAndDocs = [
    ...readdirSync(join(ROOT, "src"), { recursive: true, withFileTypes: true }),
    ...readdirSync(join(ROOT, "docs"), { recursive: true, withFileTypes: true }).filter((entry) => !entry.parentPath.startsWith(ADR_DIR)),
  ].filter((entry) => entry.isFile() && /\.(ts|md)$/.test(entry.name)).map((entry) => join(entry.parentPath, entry.name));
  return [...sourcesAndDocs, join(ROOT, "README.md"), join(ROOT, "CONTRIBUTING.md")];
}

describe("the ADRs", () => {
  const adrFiles = readdirSync(ADR_DIR).sort();
  const texts = citingFiles().map((path) => ({ path, text: readFileSync(path, "utf8") }));

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
