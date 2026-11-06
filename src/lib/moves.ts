/**
 * Moving a statement or a class member somewhere else in its list, for the ordering rules (`stepdown-order`,
 * `fields-first`, `loop-variable-in-loop`). A move takes the code's own lines and the comments attached to them, and
 * follows the catalog's "How fixes stay safe": the removal uses `removeRange`, and the insertion is checked with
 * `continuesStatement`.
 */
import type { Rule, SourceCode } from "eslint";
import type { Comment, Node, Token } from "./ast.ts";
import { continuesStatement, isDirectiveComment, removeRange, semicolonGuard, wholeLinesRange } from "./safe-fix.ts";

type Range = [number, number];

/** Directive comments that apply to the code right after them, so they belong to it and move with it. */
const NEXT_LINE_DIRECTIVE = /-next-line\b|^\s*@ts-(expect-error|ignore)\b|prettier-ignore|\bignore\s+next\b|biome-ignore|deno-lint-ignore|deno-fmt-ignore|dprint-ignore/;

/** The code a fix moves: some nodes, with the comments attached to them, on lines of their own. */
export interface Block {
  /** From the first attached comment to the end of the last node, or of a comment after it on the same line. */
  range: Range;
  /** The whole lines `range` covers, with the line break after them. */
  lines: Range;
  /** The first and last tokens of the nodes themselves, without the comments. */
  firstToken: Token;
  lastToken: Token;
}

/**
 * Whether a comment above a node belongs to it: it starts its line, and no blank line separates it from the code below.
 * A directive that covers a region (`eslint-disable`, `#region`, a license) stays where it is.
 */
function isAttached(sourceCode: SourceCode, comment: Comment, below: number): boolean {
  const text = sourceCode.text;
  const [start, end] = comment.range as Range;
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  if (text.slice(lineStart, start).trim() !== "") return false;
  if (/\n[ \t]*\r?\n/.test(text.slice(end, below))) return false;
  return !isDirectiveComment(comment) || NEXT_LINE_DIRECTIVE.test(comment.value);
}

/** The comments directly above `node` that belong to it, in source order. */
export function leadingComments(sourceCode: SourceCode, node: Node): Comment[] {
  const before = sourceCode.getCommentsBefore(node as never) as Comment[];
  const attached: Comment[] = [];
  let below = node.range[0];
  for (let index = before.length - 1; index >= 0 && isAttached(sourceCode, before[index], below); index--) {
    attached.unshift(before[index]);
    below = (before[index].range as Range)[0];
  }
  return attached;
}

/** The comments after `node` on the line where it ends. */
function trailingComments(sourceCode: SourceCode, node: Node): Comment[] {
  const endLine = node.loc.end.line;
  return (sourceCode.getCommentsAfter(node as never) as Comment[]).filter((comment) => comment.loc!.start.line === endLine);
}

/** The block from `first` to `last` (the same node for one), or `null` when it shares a line with other code. */
export function blockOf(sourceCode: SourceCode, first: Node, last: Node = first): Block | null {
  const leading = leadingComments(sourceCode, first);
  const trailing = trailingComments(sourceCode, last);
  const start = leading.length > 0 ? (leading[0].range as Range)[0] : first.range[0];
  const end = trailing.length > 0 ? (trailing[trailing.length - 1].range as Range)[1] : last.range[1];
  const lines = wholeLinesRange(sourceCode.text, start, end);
  if (!lines) return null;
  const firstToken = sourceCode.getFirstToken(first as never) as Token;
  const lastToken = sourceCode.getLastToken(last as never) as Token;
  return { range: [start, end], lines, firstToken, lastToken };
}

/** The block's lines, without the line break after the last one. */
export function blockText(sourceCode: SourceCode, block: Block): string {
  return sourceCode.text.slice(block.lines[0], block.range[1]);
}

function isBlankLine(text: string, lineStart: number): boolean {
  const lineEnd = text.indexOf("\n", lineStart);
  return text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd).trim() === "" && lineEnd !== -1;
}

function previousLineStart(text: string, lineStart: number): number {
  return text.lastIndexOf("\n", lineStart - 2) + 1;
}

/** Whether the token next to `offset` (before or after it, comments included) is `brace`, or there is none. */
function besideBrace(sourceCode: SourceCode, offset: number, brace: "{" | "}"): boolean {
  const range = { range: [offset, offset] } as never;
  const token = (brace === "{" ? sourceCode.getTokenBefore(range, { includeComments: true }) : sourceCode.getTokenAfter(range, { includeComments: true })) as Token | null;
  return !token || (token.type === "Punctuator" && token.value === brace);
}

/**
 * Removes a block, with `removeRange` so the code after it never continues the statement before it. One blank line next
 * to it goes too when the removal would otherwise leave two gaps in a row, or a gap after the list's `{` or before its `}`.
 */
export function removeBlock(fixer: Rule.RuleFixer, sourceCode: SourceCode, block: Block): Rule.Fix[] {
  const removal = removeRange(fixer, sourceCode, block.range);
  if (semicolonGuard(sourceCode, block.range)) return [removal];
  const text = sourceCode.text;
  const [start, after] = block.lines;
  const above = start > 0 ? previousLineStart(text, start) : -1;
  const blankAbove = above !== -1 && isBlankLine(text, above);
  if (isBlankLine(text, after) && (blankAbove || besideBrace(sourceCode, start, "{"))) {
    return [removal, fixer.removeRange([after, text.indexOf("\n", after) + 1])];
  }
  if (blankAbove && besideBrace(sourceCode, after, "}")) return [fixer.removeRange([above, start]), removal];
  return [removal];
}

/** Whether a blank line separates `block` from the code after it, so a moved copy keeps the same spacing. */
export function blankLineAfter(sourceCode: SourceCode, block: Block): boolean {
  return isBlankLine(sourceCode.text, block.lines[1]);
}

/**
 * Where code can be inserted on its own line after `node`: the end of the line `node` ends on. `null` when other code, or a
 * comment that runs onto the next line, follows `node` on that line.
 */
export function endOfLineAfter(sourceCode: SourceCode, node: Node): number | null {
  const text = sourceCode.text;
  const newline = text.indexOf("\n", node.range[1]);
  const lineEnd = newline === -1 ? text.length : newline;
  const next = sourceCode.getTokenAfter(node as never) as Token | null;
  if (next && next.range[0] < lineEnd) return null;
  const spills = trailingComments(sourceCode, node).some((comment) => (comment.range as Range)[1] > lineEnd);
  return spills ? null : lineEnd;
}

/**
 * The text of `block` inserted on new lines after `previous` (the last token before the insertion point), with a `;` in
 * front when the block's first token would otherwise continue `previous`'s statement.
 */
export function insertedAfter(sourceCode: SourceCode, previous: Token, block: Block, blankLine: boolean): string {
  const guard = continuesStatement(previous, block.firstToken) ? ";" : "";
  return `\n${blankLine ? "\n" : ""}${guard}${blockText(sourceCode, block)}`;
}

/**
 * The text of `block` ending with a `;` when `next` (the first token after the insertion point) would otherwise continue
 * the block's last statement or member.
 */
export function guardedBefore(sourceCode: SourceCode, block: Block, next: Token | null): string {
  const text = blockText(sourceCode, block);
  if (!continuesStatement(block.lastToken, next)) return text;
  const cut = block.lastToken.range[1] - block.lines[0];
  return `${text.slice(0, cut)};${text.slice(cut)}`;
}

/** The node's own sibling: the ancestor of `node` (or `node` itself) whose parent is `container`. */
export function childOf(node: Node, container: Node): Node | null {
  let current: Node | undefined = node;
  while (current && current.parent !== container) current = current.parent;
  return current ?? null;
}
