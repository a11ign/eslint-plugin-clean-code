/**
 * The catalog's "How fixes stay safe" rules, written once so every fix follows them the same way.
 *
 * 1. Removing or moving code never joins two statements: see `continuesStatement` and `semicolonGuard`.
 * 2. Deleting a comment never changes how the code around it parses: see `removeComment`.
 * 3. Directive comments are never changed: see `isDirectiveComment`.
 */
import type { Rule, SourceCode } from "eslint";
import type { Comment, Token } from "./ast.ts";

type Range = [number, number];

/** A line starting with one of these continues the statement above it when that statement has no `;`. */
const CONTINUING_START = /^[([`+\-/*]/;

/**
 * Binary operators spelled as words. No statement starts with one, but in a class body a member can be named `in` or
 * `instanceof`, and after a field without `;` (`x = 2` then `in() {}`) it continues the field's initializer.
 */
const CONTINUING_WORD = new Set(["in", "instanceof"]);

/**
 * Removes `range` from `sourceCode` as `fixer` fixes and, when nothing else is on its lines, the lines themselves, adding a
 * `;` before the code that follows when that code would otherwise continue the statement before the removed one.
 */
export function removeRange(fixer: Rule.RuleFixer, sourceCode: SourceCode, range: Range): Rule.Fix {
  const removed = wholeLinesRange(sourceCode.text, range[0], range[1]) ?? range;
  if (!semicolonGuard(sourceCode, range)) return fixer.removeRange(removed);
  const next = sourceCode.getTokenAfter({ range } as never) as Token;
  return fixer.replaceTextRange([removed[0], next.range[0]], `${sourceCode.text.slice(removed[1], next.range[0])};`);
}

/**
 * The range of the whole lines of `text` that `start` up to `end` covers, with the line break after them, when nothing but
 * blank space shares those lines.
 */
export function wholeLinesRange(text: string, start: number, end: number): Range | null {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const lineEndIndex = text.indexOf("\n", end);
  const lineEnd = lineEndIndex === -1 ? text.length : lineEndIndex;
  if (text.slice(lineStart, start).trim() !== "" || text.slice(end, lineEnd).trim() !== "") return null;
  return [lineStart, lineEndIndex === -1 ? lineEnd : lineEnd + 1];
}

/** `";"` when removing `range` from `sourceCode` would let the code after it continue the statement before it, else `""`. */
export function semicolonGuard(sourceCode: SourceCode, range: Range): string {
  const previous = sourceCode.getTokenBefore({ range } as never) as Token | null;
  const next = sourceCode.getTokenAfter({ range } as never) as Token | null;
  return continuesStatement(previous, next) ? ";" : "";
}

/**
 * Whether `next`, placed directly after `previous`, would be read as part of `previous`'s statement (or class field).
 * Only a `;` or a `{` before it, or nothing at all, makes the start of `next` the start of a new statement for certain.
 */
export function continuesStatement(previous: Token | Comment | null, next: Token | Comment | null): boolean {
  if (!previous || !next) return false;
  if (endsStatementForCertain(previous)) return false;
  if (next.type === "Template" || next.type === "RegularExpression") return true;
  return CONTINUING_START.test(next.value) || CONTINUING_WORD.has(next.value);
}

/** Whether `token` is a `;` or a `{`, after which the next token starts a new statement for certain. */
function endsStatementForCertain(token: Token | Comment): boolean {
  return token.type === "Punctuator" && STATEMENT_STARTS_AFTER.has(token.value);
}

const STATEMENT_STARTS_AFTER: ReadonlySet<string> = new Set([";", "{"]);

/** Every character JavaScript reads as a line break, as escaped strings: a raw U+2028 in a regex literal does not parse. */
const LINE_BREAKS = ["\n", "\r", "\u2028", "\u2029"];

/**
 * Deletes `comment` from `sourceCode` as `fixer` fixes, without changing how the code around it parses.
 * - Alone on its lines: the lines go.
 * - Code on both sides on the same line: it becomes one space, so `return/*x*\/value` never becomes `returnvalue`.
 * - A block comment containing a line break (`\n`, `\r`, U+2028 or U+2029), with code beside it: it becomes a line break, because a line break can end a statement.
 * - Code only before it: it goes with the blank space between.
 * - Code only after it: it goes with the blank space after it.
 */
export function removeComment(fixer: Rule.RuleFixer, sourceCode: SourceCode, comment: Comment): Rule.Fix {
  const text = sourceCode.text;
  const [start, end] = comment.range as Range;
  const lines = wholeLinesRange(text, start, end);
  if (lines) return fixer.removeRange(lines);
  if (hasLineBreak(text.slice(start, end))) return fixer.replaceTextRange([start, end], "\n");
  return removeCommentBesideCode(fixer, text, [start, end]);
}

/**
 * Deletes the one-line comment from `start` to `end` of `text` that shares its line with code, as `fixer` fixes, as
 * `removeComment`'s last three cases say.
 */
function removeCommentBesideCode(fixer: Rule.RuleFixer, text: string, [start, end]: Range): Rule.Fix {
  const before = text.slice(text.lastIndexOf("\n", start - 1) + 1, start);
  const lineEnd = text.indexOf("\n", end);
  const after = text.slice(end, lineEnd === -1 ? text.length : lineEnd);
  const codeBefore = before.trim() !== "";
  if (codeBefore && after.trim() !== "") return fixer.replaceTextRange([start, end], " ");
  if (codeBefore) return fixer.removeRange([start - trailingSpace(before), end]);
  return fixer.removeRange([start, end + leadingSpace(after)]);
}

/** Whether `text` holds a line break: `\n`, but also `\r`, U+2028 and U+2029, which end a statement the same way. */
export function hasLineBreak(text: string): boolean {
  return LINE_BREAKS.some((lineBreak) => text.includes(lineBreak));
}

/** How many blank characters `text` ends with. */
function trailingSpace(text: string): number {
  return text.length - text.trimEnd().length;
}

/** How many blank characters `text` starts with. */
function leadingSpace(text: string): number {
  return text.length - text.trimStart().length;
}

const DIRECTIVE = [
  /^\s*(eslint|eslint-disable|eslint-enable|eslint-disable-line|eslint-disable-next-line|oxlint|oxlint-disable|oxlint-enable|globals?|exported)\b/,
  /^\s*@ts-/,
  /^\s*prettier-ignore\b/,
  /[#@]__(PURE|NO_SIDE_EFFECTS)__/,
  /^\/\s*<(reference|amd-module|amd-dependency)\b/,
  /@(license|preserve|jsx|jsxFrag|jsxImportSource|jsxRuntime)\b/,
  /^!/,
  /\bwebpack[A-Z][A-Za-z]*\s*:/,
  /@vite-ignore\b/,
  /^\s*(istanbul|c8|v8|node:coverage)\s+(ignore|disable|enable)\b/,
  /^\s*(biome-ignore|deno-lint-ignore|deno-fmt-ignore|dprint-ignore)\b/,
  /^\s*#(region|endregion)\b/,
  /^[#@]\s*source(Mapping)?URL=/,
  /^\s*language=/,
  /^\s*noinspection\b/,
];

/** Whether `comment` is read by a tool (a linter, a compiler, a bundler or a formatter), so no fix may change or remove it. */
export function isDirectiveComment(comment: Comment): boolean {
  return DIRECTIVE.some((pattern) => pattern.test(comment.value));
}

/** Whether `comment` is a doc comment (`/** … *\/`). */
export function isDocComment(comment: Comment): boolean {
  return comment.type === "Block" && comment.value.startsWith("*") && !comment.value.startsWith("**");
}
