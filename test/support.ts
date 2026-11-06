/**
 * Helpers for the tests that run whole configs: ESLint through its `ESLint` class, and Oxlint through its own binary on
 * files copied into `test/work/`, inside this package, so `eslint-plugin-clean-code-book/…` resolves to the built package
 * the way it does in a project that installed it.
 */
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { ESLint, type Linter } from "eslint";

export const ROOT = fileURLToPath(new URL("../", import.meta.url));
const WORK = join(ROOT, "test", "work");
const OXLINT = join(ROOT, "node_modules", ".bin", "oxlint");

const SOURCE_PATTERNS = ["**/*.{js,jsx,ts,tsx}"];

export interface Report {
  file: string;
  rules: string[];
  /** The rules in `rules` reported as warnings rather than errors. */
  warnings: string[];
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

/** Runs Oxlint with `config` (by default this package's `recommended`) on every source file in `dir`, and returns what it reported per file. */
export function runOxlint(dir: string, extraArgs: string[] = [], config = OXLINT_CONFIG): Report[] {
  writeFileSync(join(dir, "oxlint.config.ts"), config);
  // The files are named one by one: given a directory, Oxlint skips what the repository's `.gitignore` ignores, `test/work/` included, even with `--no-ignore`.
  const files = Object.keys(readTree(dir)).filter((name) => /\.[cm]?[jt]sx?$/.test(name) && name !== "oxlint.config.ts");
  const result = spawnSync(OXLINT, ["-c", "oxlint.config.ts", "--no-ignore", "--format", "json", ...extraArgs, ...files], { cwd: dir, encoding: "utf8" });
  if (result.error) throw result.error;
  let parsed: { diagnostics: Array<{ filename: string; code: string; severity: string }> };
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    throw new Error(`oxlint gave no JSON (exit ${result.status}):\n${result.stdout}\n${result.stderr}`);
  }
  const byFile = new Map<string, Report>();
  for (const diagnostic of parsed.diagnostics) {
    const report = byFile.get(diagnostic.filename) ?? { file: diagnostic.filename, rules: [], warnings: [] };
    const rule = oxlintRuleName(diagnostic.code);
    report.rules.push(rule);
    if (diagnostic.severity === "warning") report.warnings.push(rule);
    byFile.set(diagnostic.filename, report);
  }
  return [...byFile.values()];
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
export async function runEslint(dir: string, config: Linter.Config[], fix = false, patterns = SOURCE_PATTERNS): Promise<Report[]> {
  return lintWith(new ESLint({ cwd: dir, overrideConfigFile: true, overrideConfig: config, fix }), dir, fix, patterns);
}

/** Runs ESLint on every source file in `dir` with the `eslint.config.js` found there, as `npx eslint .` would. */
export async function runEslintWithConfigFile(dir: string): Promise<Report[]> {
  return lintWith(new ESLint({ cwd: dir }), dir, false, SOURCE_PATTERNS);
}

async function lintWith(eslint: ESLint, dir: string, fix: boolean, patterns: string[]): Promise<Report[]> {
  const results = await eslint.lintFiles(patterns);
  if (fix) await ESLint.outputFixes(results);
  return results.map((result) => {
    const rules = result.messages.map((message) => message.ruleId ?? `fatal: ${message.message}`);
    const warnings = result.messages.filter((message) => message.severity === 1).map((message) => message.ruleId ?? "");
    return { file: relative(dir, result.filePath), rules, warnings };
  });
}

/** The code block of README.md that follows `<!-- setup: <name> -->`: the setup a project copies, run as written. */
export function readmeBlock(name: string): string {
  const readme = readFileSync(join(ROOT, "README.md"), "utf8");
  const match = new RegExp(`<!-- setup: ${name} -->\\n\`\`\`\\w+\\n([\\s\\S]*?)\`\`\`\\n`).exec(readme);
  if (!match) throw new Error(`README.md has no setup block named ${name}`);
  return match[1];
}

/**
 * Runs `lint` on a fresh copy of `fixtureDir`, with `eslint.config.js` set to `eslintConfig` when one is given, after `prepare`
 * has changed the copy, and removes the copy afterwards.
 */
export async function onFixtures<T>(
  fixtureDir: string,
  lint: (dir: string) => Promise<T> | T,
  eslintConfig?: string,
  prepare?: (dir: string) => void,
): Promise<T> {
  const work = copyFixtures(fixtureDir);
  try {
    if (eslintConfig) writeFileSync(join(work.dir, "eslint.config.js"), eslintConfig);
    prepare?.(work.dir);
    return await lint(work.dir);
  } finally {
    work.dispose();
  }
}

/** The rules matching `related` that each file got, sorted, leaving out the files that got none. */
export function relatedReports(reports: Report[], related: RegExp): Record<string, string[]> {
  const byFile = reports.map((report) => [report.file, report.rules.filter((rule) => related.test(rule)).sort()] as const);
  return Object.fromEntries(byFile.filter(([, rules]) => rules.length > 0).sort(([a], [b]) => a.localeCompare(b)));
}

export function assertNoParseErrors(reports: Report[]): void {
  for (const report of reports) assert.ok(!report.rules.some((rule) => rule.startsWith("fatal")), `${report.file}: ${report.rules.join(", ")}`);
}
