/**
 * What the tests of the plugin against its catalogs, configs and docs share: the docs they read, the registered rules, which
 * config a rule's prefix names, and how to read a markdown table and a config's rules.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Linter } from "eslint";
import plugin from "../src/index.ts";
import { AI_RULE_PREFIX, NODE_RULE_PREFIX, REACT_RULE_PREFIX, TYPESCRIPT_RULE_PREFIX } from "../src/lib/define-rule.ts";
import { ROOT } from "./support.ts";

export const catalog = readFileSync(join(ROOT, "docs", "catalog.md"), "utf8");
export const aiCatalog = readFileSync(join(ROOT, "docs", "catalog-ai.md"), "utf8");
export const typescriptCatalog = readFileSync(join(ROOT, "docs", "catalog-typescript.md"), "utf8");
export const nodeCatalog = readFileSync(join(ROOT, "docs", "catalog-node.md"), "utf8");
export const reactCatalog = readFileSync(join(ROOT, "docs", "catalog-react.md"), "utf8");
export const readme = readFileSync(join(ROOT, "README.md"), "utf8");
export const rules = plugin.rules as unknown as Record<string, { meta: { fixable?: string; messages: Record<string, string>; docs: { url: string; requiresTypeChecking: boolean; source?: { entry: string; passage: string } } } }>;
export const isAiRule = (name: string) => name.startsWith(AI_RULE_PREFIX);
export const isNodeRule = (name: string) => name.startsWith(NODE_RULE_PREFIX);
export const isReactRule = (name: string) => name.startsWith(REACT_RULE_PREFIX);
export const isTypescriptRule = (name: string) => name.startsWith(TYPESCRIPT_RULE_PREFIX);
export const isLanguageRule = (name: string) => isTypescriptRule(name) || isNodeRule(name) || isReactRule(name);

/** The opt-in language configs whose rules quote a book of their own: the config, its rule folder, its catalog and its books. */
export const LANGUAGES = [
  { config: "typescript", isRule: isTypescriptRule, catalog: typescriptCatalog, catalogFile: "docs/catalog-typescript.md", entry: /TS-\d{2}/, books: /Programming TypeScript|JavaScript: The Definitive Guide/ },
  { config: "node", isRule: isNodeRule, catalog: nodeCatalog, catalogFile: "docs/catalog-node.md", entry: /NODE-\d{2}/, books: /Distributed Systems with Node\.js|JavaScript: The Definitive Guide/ },
  { config: "react", isRule: isReactRule, catalog: reactCatalog, catalogFile: "docs/catalog-react.md", entry: /RCT-\d{2}/, books: /Learn React with TypeScript/ },
] as const;

/** Where a rule's doc page is, by the config its prefix names. */
export function docPath(name: string): string {
  if (isAiRule(name)) return `docs/rules/ai/${name}.md`;
  const language = LANGUAGES.find((candidate) => candidate.isRule(name));
  return language ? `docs/rules/${language.config}/${name}.md` : `docs/rules/${name}.md`;
}

/** The cells of a markdown table row. A `|` inside a cell is written `\\|`, as GitHub tables need, so only an unescaped `|` ends one. */
export function tableCells(line: string): string[] {
  return line.split(/(?<!\\)\|/).slice(1, -1).map((cell) => cell.trim());
}

export function rulesOf(config: Linter.Config[]): Record<string, unknown> {
  return Object.assign({}, ...config.map((entry) => entry.rules ?? {}));
}
