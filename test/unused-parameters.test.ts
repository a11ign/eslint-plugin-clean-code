/**
 * TS-09 in `recommended`: a parameter prefixed with `_` is unused on purpose, under ESLint for JavaScript, ESLint for
 * TypeScript and Oxlint, each loading the BUILT package by its name. Only parameters are exempt, and a `_` parameter that is
 * read is reported, because its prefix then says something untrue.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { readmeBlock, relatedReports, runEslintWithConfigFile, runOxlint, workDirectory } from "./support.ts";
import { recommended as oxlintRecommended } from "../src/oxlint.ts";
import cleanCode from "../src/index.ts";

const UNUSED = /^(@typescript-eslint\/)?no-unused-vars$/;

const CASES: Record<string, string> = {
  "underscore.js": "export function last(a, _req) {\n  return a;\n}\n",
  "plain.js": "export function last(a, req) {\n  return a;\n}\n",
  "used.js": "export function last(_x) {\n  return _x;\n}\n",
  "variable.js": "const _x = 1;\nexport const y = 2;\n",
  "destructured.js": "const [_y, z] = [1, 2];\nexport const w = z;\n",
  "caught.js": "try {\n  JSON.parse(\"\");\n} catch (_e) {\n  throw new Error(\"x\");\n}\n",
  "underscore.ts": "export function last(a: number, _req: number): number {\n  return a;\n}\n",
  "plain.ts": "export function last(a: number, req: number): number {\n  return a;\n}\n",
  "used.ts": "export function last(_x: number): number {\n  return _x;\n}\n",
  "variable.ts": "const _x = 1;\nexport const y = 2;\n",
  "destructured.ts": "const [_y, z] = [1, 2];\nexport const w = z;\n",
  "caught.ts": "try {\n  JSON.parse(\"\");\n} catch (_e) {\n  throw new Error(\"x\");\n}\n",
};

/** The files that get an unused-variable report: the same in all three setups, for both languages. */
const EXPECTED = ["plain", "used", "variable", "destructured", "caught"].flatMap((name) => [`${name}.js`, `${name}.ts`]).sort();

/** The files of `CASES` that `lint` reports an unused-variable rule in, sorted. */
async function reportedFiles(lint: (dir: string) => Promise<Record<string, string[]>> | Record<string, string[]>): Promise<string[]> {
  const work = workDirectory(CASES);
  try {
    return Object.entries(await lint(work.dir)).filter(([, rules]) => rules.length > 0).map(([file]) => file).sort();
  } finally {
    work.dispose();
  }
}

describe("TS-09: a parameter prefixed with _ is unused on purpose", () => {
  it("ESLint (JavaScript and TypeScript): only the unprefixed parameter, the used _ parameter, and non-parameters are reported", async () => {
    const files = await reportedFiles(async (dir) => {
      writeFileSync(join(dir, "eslint.config.js"), readmeBlock("eslint-typescript"));
      return relatedReports(await runEslintWithConfigFile(dir), UNUSED);
    });
    assert.deepEqual(files, EXPECTED);
  });

  it("Oxlint: the same files are reported", async () => {
    const files = await reportedFiles((dir) => relatedReports(runOxlint(dir, [], readmeBlock("oxlint")), UNUSED));
    assert.deepEqual(files, EXPECTED);
  });

  it("the import fix guards stay in all three configs", () => {
    const tsConfig = cleanCode.configs.recommended.find((config) => config.rules?.["@typescript-eslint/no-unused-vars"]);
    const [, tsOptions] = tsConfig?.rules?.["@typescript-eslint/no-unused-vars"] as [string, Record<string, unknown>];
    assert.deepEqual(tsOptions, { argsIgnorePattern: "^_", reportUsedIgnorePattern: true, enableAutofixRemoval: { imports: false } });
    const [, oxOptions] = oxlintRecommended.rules["no-unused-vars"] as [string, Record<string, unknown>];
    assert.deepEqual(oxOptions, { argsIgnorePattern: "^_", reportUsedIgnorePattern: true, fix: { imports: "off", variables: "off" } });
  });
});
