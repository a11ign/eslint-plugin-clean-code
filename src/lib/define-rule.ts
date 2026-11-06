/**
 * One shape for every rule in this plugin, so each report reads the same way to an agent: the problem, the passage of
 * *Clean Code, 2nd Edition* it breaks, and the refactor the book recommends. Rules are written against the rule API ESLint
 * and Oxlint share (ADR 0002), so `create` sees only `context.sourceCode`, `context.options`, `context.report` and the
 * visitor object.
 */
import type { Rule } from "eslint";

export const PACKAGE_NAME = "eslint-plugin-clean-code-book";

/** Where a rule's doc page is served from: the published package's own `docs/rules/`, so the link moves with the package. */
export function docsUrl(ruleName: string): string {
  return `https://unpkg.com/${PACKAGE_NAME}/docs/rules/${ruleName}.md`;
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

/** One report a rule can make. `problem` may use `{{placeholders}}` filled from the report's `data`. */
export interface MessageSpec {
  problem: string;
  refactor: string;
}

export interface RuleSpec<Options extends unknown[] = unknown[]> {
  name: string;
  type: "problem" | "suggestion" | "layout";
  description: string;
  book: BookSource;
  messages: Record<string, MessageSpec>;
  /** Set when the rule has an autofix (complete or partial). */
  fixable?: "code";
  /** Set when the rule needs TypeScript type information, so it ships only in `recommended-type-checked`. */
  requiresTypeChecking?: boolean;
  schema?: Rule.RuleMetaData["schema"];
  defaultOptions?: Options;
  create: (context: Rule.RuleContext) => Rule.RuleListener;
}

/** The text of one message: the problem, then the book passage, then the refactor. */
export function bookMessage(message: MessageSpec, book: BookSource): string {
  return `${message.problem} Clean Code, ${book.chapter}: "${book.passage}" Refactor: ${message.refactor}`;
}

export interface CleanCodeDocs {
  description: string;
  url: string;
  requiresTypeChecking: boolean;
  book: BookSource;
}

export type CleanCodeRule = Rule.RuleModule & { meta: Rule.RuleMetaData & { docs: CleanCodeDocs } };

export function defineRule<Options extends unknown[]>(spec: RuleSpec<Options>): CleanCodeRule {
  const messages = Object.fromEntries(
    Object.entries(spec.messages).map(([id, message]) => [id, bookMessage(message, spec.book)]),
  );
  const docs: CleanCodeDocs = {
    description: spec.description,
    url: docsUrl(spec.name),
    requiresTypeChecking: spec.requiresTypeChecking ?? false,
    book: spec.book,
  };
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
