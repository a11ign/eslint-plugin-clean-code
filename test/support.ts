/**
 * Helpers for the tests that run whole configs: ESLint through its `ESLint` class, and Oxlint through its own binary on
 * files copied into `test/work/`, inside this package, so `eslint-plugin-clean-code-book/…` resolves to the built package
 * the way it does in a project that installed it.
 */
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint, type Linter } from "eslint";

export const ROOT = fileURLToPath(new URL("../", import.meta.url));
const WORK = join(ROOT, "test", "work");
const OXLINT = join(ROOT, "node_modules", ".bin", "oxlint");

export interface Report {
  file: string;
  rules: string[];
}

/** A fresh directory under `test/work/` holding `files`, removed by `dispose`. */
export function workDirectory(files: Record<string, string>): { dir: string; dispose: () => void } {
  mkdirSync(WORK, { recursive: true });
  const dir = mkdtempSync(join(WORK, "case-"));
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(dir, name, ".."), { recursive: true });
    writeFileSync(join(dir, name), text);
  }
  return { dir, dispose: () => rmSync(dir, { recursive: true, force: true }) };
}

/** A copy of a fixture directory under `test/work/`. */
export function copyFixtures(fixtureDir: string): { dir: string; dispose: () => void } {
  const work = workDirectory({});
  cpSync(fixtureDir, work.dir, { recursive: true });
  return work;
}

export function readTree(dir: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    files[relative(dir, path)] = readFileSync(path, "utf8");
  }
  return files;
}

export const OXLINT_CONFIG = `import { recommended } from "eslint-plugin-clean-code-book/oxlint";\n\nexport default { extends: [recommended] };\n`;

/** Runs Oxlint with this package's `recommended` on every source file in `dir`, and returns what it reported per file. */
export function runOxlint(dir: string, extraArgs: string[] = []): Report[] {
  writeFileSync(join(dir, "oxlint.config.ts"), OXLINT_CONFIG);
  // The files are named one by one: given a directory, Oxlint skips what the repository's `.gitignore` ignores, `test/work/` included, even with `--no-ignore`.
  const files = Object.keys(readTree(dir)).filter((name) => /\.[cm]?[jt]sx?$/.test(name) && name !== "oxlint.config.ts");
  const result = spawnSync(OXLINT, ["-c", "oxlint.config.ts", "--no-ignore", "--format", "json", ...extraArgs, ...files], { cwd: dir, encoding: "utf8" });
  if (result.error) throw result.error;
  let parsed: { diagnostics: Array<{ filename: string; code: string }> };
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    throw new Error(`oxlint gave no JSON (exit ${result.status}):\n${result.stdout}\n${result.stderr}`);
  }
  const byFile = new Map<string, string[]>();
  for (const diagnostic of parsed.diagnostics) {
    const rules = byFile.get(diagnostic.filename) ?? [];
    rules.push(oxlintRuleName(diagnostic.code));
    byFile.set(diagnostic.filename, rules);
  }
  return [...byFile].map(([file, rules]) => ({ file, rules }));
}

/** `eslint(max-params)` gives `max-params`, `clean-code-book(stepdown-order)` gives `clean-code-book/stepdown-order`. */
function oxlintRuleName(code: string): string {
  const match = /^([\w-]+)\((.+)\)$/.exec(code);
  if (!match) return code;
  const [, plugin, rule] = match;
  if (plugin === "eslint") return rule;
  if (plugin === "typescript-eslint" || plugin === "typescript") return `@typescript-eslint/${rule}`;
  return `${plugin}/${rule}`;
}

/** Runs ESLint with `config` on every source file in `dir`. */
export async function runEslint(dir: string, config: Linter.Config[], fix = false, patterns = ["**/*.{js,jsx,ts,tsx}"]): Promise<Report[]> {
  const eslint = new ESLint({ cwd: dir, overrideConfigFile: true, overrideConfig: config, fix });
  const results = await eslint.lintFiles(patterns);
  if (fix) await ESLint.outputFixes(results);
  return results.map((result) => ({ file: relative(dir, result.filePath), rules: result.messages.map((message) => message.ruleId ?? `fatal: ${message.message}`) }));
}
