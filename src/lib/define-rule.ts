/**
 * One shape for every rule in this plugin, so each report reads the same way to an agent: the problem, the passage of
 * *Clean Code, 2nd Edition* it breaks (or, for a rule of the opt-in `ai` config, the AI pattern and its harm; for one of the opt-in
 * `node` config, the passage of its Node book), and the refactor. Rules are written against the rule API ESLint
 * and Oxlint share (ADR 0002), so `create` sees only `context.sourceCode`, `context.options`, `context.report` and the
 * visitor object.
 */
import type { Rule } from "eslint";

export const PACKAGE_NAME = "eslint-plugin-clean-code-book";

/** Where a rule's doc page is served from: the published package's own `docs/rules/`, so the link moves with the package. */
export function docsUrl(ruleName: string): string {
  return `https://unpkg.com/${PACKAGE_NAME}/docs/rules/${ruleName}.md`;
}

/** The rules of the opt-in `ai` config are named `ai-<name>`, and their doc pages are under `docs/rules/ai/`. */
export const AI_RULE_PREFIX = "ai-";

/** Where an `ai` rule's doc page is served from. */
export function aiDocsUrl(ruleName: string): string {
  return `https://unpkg.com/${PACKAGE_NAME}/docs/rules/ai/${ruleName}.md`;
}

/** The rules of the opt-in `node` config are named `node-<name>`, and their doc pages are under `docs/rules/node/`. */
export const NODE_RULE_PREFIX = "node-";

/** Where a `node` rule's doc page is served from. */
export function nodeDocsUrl(ruleName: string): string {
  return `https://unpkg.com/${PACKAGE_NAME}/docs/rules/node/${ruleName}.md`;
}

/** The passage a rule enforces: the chapter and section, and the quote copied from the catalog entry. */
export interface BookSource {
  /** The catalog entry id, such as `FH-01`. */
  entry: string;
  /** Chapter number, title and section, such as `8 Function Heuristics § Flag Arguments`. */
  chapter: string;
  /** A short verbatim passage from the catalog entry's quote. */
  passage: string;
}

/**
 * The habit of AI-generated code an `ai` rule checks, from its `docs/catalog-ai.md` entry. It takes the place of a book
 * passage: an `ai` rule is justified by the pattern and the harm it does, not by the book (ADR 0001).
 */
export interface AiPattern {
  /** The catalog entry id, such as `AI-01`. */
  entry: string;
  /** The pattern's short name, such as `narrating comments`. */
  name: string;
  /** One sentence on the harm the pattern does. */
  harm: string;
}

/**
 * The passage of a Node book a `node` rule enforces, from its `docs/catalog-node.md` entry. It takes the place of a passage of
 * *Clean Code*: the `node` config's rules come from the Node books in the bookCTX library (ADR 0004 of A11-415).
 */
export interface NodeSource {
  /** The catalog entry id, such as `NODE-01`. */
  entry: string;
  /** The book's title, such as `Distributed Systems with Node.js`. */
  book: string;
  /** The section the passage sits under, such as `§ Event Loop Tips`. */
  section: string;
  /** A short verbatim passage from the catalog entry's quote. */
  passage: string;
}

/** One report a rule can make. `problem` may use `{{placeholders}}` filled from the report's `data`. */
export interface MessageSpec {
  problem: string;
  refactor: string;
}

interface SpecBase<Options extends unknown[]> {
  name: string;
  type: "problem" | "suggestion" | "layout";
  description: string;
  messages: Record<string, MessageSpec>;
  /** Set when the rule has an autofix (complete or partial). */
  fixable?: "code";
  /** Set when the rule needs TypeScript type information, so it ships only in `recommended-type-checked`. */
  requiresTypeChecking?: boolean;
  schema?: Rule.RuleMetaData["schema"];
  defaultOptions?: Options;
  create: (context: Rule.RuleContext) => Rule.RuleListener;
}

export interface RuleSpec<Options extends unknown[] = unknown[]> extends SpecBase<Options> {
  book: BookSource;
}

/** An `ai` rule: report-only, so it has no `fixable`, and it names the AI pattern where a book rule names its passage. */
export interface AiRuleSpec<Options extends unknown[] = unknown[]> extends Omit<SpecBase<Options>, "fixable" | "requiresTypeChecking"> {
  pattern: AiPattern;
}

/** The text of one message: the problem, then the book passage, then the refactor. */
export function bookMessage(message: MessageSpec, book: BookSource): string {
  return `${message.problem} Clean Code, ${book.chapter}: "${book.passage}" Refactor: ${message.refactor}`;
}

/** The text of one `ai` message: the problem, then the AI pattern and its harm, then the refactor. */
export function aiMessage(message: MessageSpec, pattern: AiPattern): string {
  return `${message.problem} AI pattern ${pattern.entry}, ${pattern.name}: ${pattern.harm} Refactor: ${message.refactor}`;
}

/** A `node` rule: report-only, like an `ai` rule, and it names its Node book where a book rule names *Clean Code*. */
export interface NodeRuleSpec<Options extends unknown[] = unknown[]> extends Omit<SpecBase<Options>, "fixable" | "requiresTypeChecking"> {
  source: NodeSource;
}

/** The text of one `node` message: the problem, then the Node book's passage, then the refactor. */
export function nodeMessage(message: MessageSpec, source: NodeSource): string {
  return `${message.problem} ${source.book}, ${source.section}: "${source.passage}" Refactor: ${message.refactor}`;
}

interface DocsBase {
  description: string;
  url: string;
  requiresTypeChecking: boolean;
}

/** A book rule's docs carry its passage, an `ai` rule's its pattern, and a `node` rule's its Node book's passage. */
export type CleanCodeDocs =
  | (DocsBase & { book: BookSource; pattern?: never; source?: never })
  | (DocsBase & { pattern: AiPattern; book?: never; source?: never })
  | (DocsBase & { source: NodeSource; book?: never; pattern?: never });

export type CleanCodeRule = Rule.RuleModule & { meta: Rule.RuleMetaData & { docs: CleanCodeDocs } };

export function defineRule<Options extends unknown[]>(spec: RuleSpec<Options>): CleanCodeRule {
  const docs: CleanCodeDocs = {
    description: spec.description,
    url: docsUrl(spec.name),
    requiresTypeChecking: spec.requiresTypeChecking ?? false,
    book: spec.book,
  };
  return buildRule(spec, docs, (message) => bookMessage(message, spec.book));
}

export function defineAiRule<Options extends unknown[]>(spec: AiRuleSpec<Options>): CleanCodeRule {
  const docs: CleanCodeDocs = { description: spec.description, url: aiDocsUrl(spec.name), requiresTypeChecking: false, pattern: spec.pattern };
  return buildRule(spec, docs, (message) => aiMessage(message, spec.pattern));
}

export function defineNodeRule<Options extends unknown[]>(spec: NodeRuleSpec<Options>): CleanCodeRule {
  const docs: CleanCodeDocs = { description: spec.description, url: nodeDocsUrl(spec.name), requiresTypeChecking: false, source: spec.source };
  return buildRule(spec, docs, (message) => nodeMessage(message, spec.source));
}

function buildRule<Options extends unknown[]>(spec: SpecBase<Options>, docs: CleanCodeDocs, write: (message: MessageSpec) => string): CleanCodeRule {
  const messages = Object.fromEntries(Object.entries(spec.messages).map(([id, message]) => [id, write(message)]));
  return {
    meta: {
      type: spec.type,
      docs,
      messages,
      schema: spec.schema ?? [],
      ...(spec.fixable ? { fixable: spec.fixable } : {}),
      ...(spec.defaultOptions ? { defaultOptions: spec.defaultOptions } : {}),
    },
    create: spec.create,
  };
}
