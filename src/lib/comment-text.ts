/**
 * Reading and rewriting comment text, shared by the comment rules (CMT-03 to CMT-11). Every rewrite goes through
 * `rewrittenComment`, which refuses a new text that would end the comment early, turn it into a doc comment or a
 * triple-slash directive, or make it a directive comment (or stop it being one).
 */
import type { Rule, SourceCode } from "eslint";
import type { Comment } from "./ast.ts";
import { hasLineBreak, isDirectiveComment, isDocComment, removeComment, wholeLinesRange } from "./safe-fix.ts";

export type Range = [number, number];
type Location = NonNullable<Comment["loc"]>;

/** The line and block comments of the file, without a hashbang. */
export function sourceComments(sourceCode: SourceCode): Comment[] {
  return sourceCode.getAllComments().filter((comment) => comment.type === "Line" || comment.type === "Block");
}

/** Whether nothing but blank space shares the comment's lines. */
export function isAloneOnItsLines(sourceCode: SourceCode, comment: Comment): boolean {
  return wholeLinesRange(sourceCode.text, comment.range![0], comment.range![1]) !== null;
}

/**
 * The comments of the file in groups: a run of line comments, each alone on its line, on consecutive lines, is one
 * group; every other comment is a group of its own. A comment for which `standsAlone` is true never joins a run.
 */
export function commentGroups(sourceCode: SourceCode, standsAlone: (comment: Comment) => boolean = () => false): Comment[][] {
  const groups: Comment[][] = [];
  let run: Comment[] = [];
  const close = () => {
    if (run.length > 0) groups.push(run);
    run = [];
  };
  for (const comment of sourceComments(sourceCode)) {
    const joinable = comment.type === "Line" && !standsAlone(comment) && isAloneOnItsLines(sourceCode, comment);
    const last = run.at(-1);
    if (!joinable || !last || last.loc!.end.line + 1 !== comment.loc!.start.line) close();
    if (joinable) run.push(comment);
    else groups.push([comment]);
  }
  close();
  return groups;
}

/** Where a group of comments starts and ends, for the report. */
export function groupLocation(group: Comment[]): Location {
  return { start: group[0].loc!.start, end: group.at(-1)!.loc!.end };
}

/** Deletes a group: one comment the safe way (`removeComment`), or a run of line comments with their whole lines. */
export function removeGroup(fixer: Rule.RuleFixer, sourceCode: SourceCode, group: Comment[]): Rule.Fix {
  if (group.length === 1) return removeComment(fixer, sourceCode, group[0]);
  return fixer.removeRange(wholeLinesRange(sourceCode.text, group[0].range![0], group.at(-1)!.range![1])!);
}

/**
 * Keeps only the comments of a run of line comments for which `keep` is true, deleting the lines of the others, or
 * deletes the whole run when the kept comments hold no text.
 */
export function keepInRun(fixer: Rule.RuleFixer, sourceCode: SourceCode, run: Comment[], keep: (comment: Comment, index: number) => boolean): Rule.Fix {
  const kept = run.filter(keep);
  if (kept.every((comment) => comment.value.trim() === "")) return removeGroup(fixer, sourceCode, run);
  const range = wholeLinesRange(sourceCode.text, run[0].range![0], run.at(-1)!.range![1])!;
  const lines = sourceCode.text.slice(range[0], range[1]).split("\n");
  const endsWithLineBreak = lines.length > run.length;
  const text = lines.slice(0, run.length).filter((_, index) => keep(run[index], index));
  return fixer.replaceTextRange(range, text.join("\n") + (endsWithLineBreak ? "\n" : ""));
}

/** One line of a comment's text: its decoration (indentation, a leading `*`, the space after) and its content. */
export interface CommentLine {
  prefix: string;
  content: string;
}

/** The line break a comment's text uses. */
export function lineBreakOf(comment: Comment): string {
  return comment.value.includes("\r\n") ? "\r\n" : "\n";
}

/** The comment's text split into lines, each with its decoration apart from its content. */
export function commentLines(comment: Comment): CommentLine[] {
  const doc = isDocComment(comment);
  return comment.value.split(lineBreakOf(comment)).map((line, index) => {
    const decoration = index === 0 ? (doc ? /^\*[ \t]*/ : /^[ \t]*/) : /^[ \t]*(?:\*(?!\*)[ \t]?)?/;
    const prefix = decoration.exec(line)![0];
    return { prefix, content: line.slice(prefix.length) };
  });
}

/** The comment text that `commentLines` split, joined back. */
export function joinLines(comment: Comment, lines: CommentLine[]): string {
  return lines.map((line) => line.prefix + line.content).join(lineBreakOf(comment));
}

/**
 * Drops the lines whose index is in `drop`. The first and last lines carry the comment's delimiters, so they are
 * emptied instead: the first keeps nothing after `/*` (or `/**`), the last keeps only its indentation before `*\/`.
 */
export function withoutLines(comment: Comment, lines: CommentLine[], drop: Set<number>): CommentLine[] {
  const last = lines.length - 1;
  return lines.flatMap((line, index) => {
    if (!drop.has(index)) return [line];
    if (index === 0) return [{ prefix: isDocComment(comment) ? "*" : "", content: "" }];
    if (index === last) return [{ prefix: /^[ \t]*/.exec(line.prefix)![0], content: "" }];
    return [];
  });
}

/** Whether a comment's lines hold no text at all. */
export function holdsNoText(lines: CommentLine[]): boolean {
  return lines.every((line) => line.content.trim() === "");
}

/**
 * The source text of `comment` with `value` as its text, or `null` when that text would change what the comment is:
 * end the comment early, hold a line break in a line comment, turn a comment into a doc comment or back, turn a line
 * comment into a triple-slash directive, or make a comment a directive or stop it being one.
 */
export function rewrittenComment(comment: Comment, value: string): string | null {
  const next = { ...comment, value } as Comment;
  if (isDirectiveComment(next) !== isDirectiveComment(comment)) return null;
  if (comment.type === "Line") {
    if (hasLineBreak(value) || (value.startsWith("/") && !comment.value.startsWith("/"))) return null;
    return `//${value}`;
  }
  if (value.includes("*/") || isDocComment(next) !== isDocComment(comment)) return null;
  return `/*${value}*/`;
}

/** Replaces the comment's text with `value`, or deletes the comment when `value` holds no text. `null` when unsafe. */
export function replaceCommentText(fixer: Rule.RuleFixer, sourceCode: SourceCode, comment: Comment, value: string): Rule.Fix | null {
  const lines = commentLines({ ...comment, value } as Comment);
  if (holdsNoText(lines)) return removeComment(fixer, sourceCode, comment);
  const text = rewrittenComment(comment, value);
  return text === null ? null : fixer.replaceTextRange(comment.range!, text);
}

/** Whether the comment starts with `TODO` or `FIXME`, which `no-warning-comments` reports (CMT-10). */
export function isWarningComment(comment: Comment): boolean {
  return /^[\s*]*(?:todo|fixme)\b/iu.test(comment.value);
}

/** The lower-case words of an identifier: `getDayOfMonth` gives `get`, `day`, `of`, `month`. */
export function nameWords(name: string): string[] {
  return name
    .replace(/([\p{Ll}\d])(\p{Lu})/gu, "$1 $2")
    .replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, "$1 $2")
    .split(/[^\p{L}\d]+/u)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
}

/** The lower-case words of prose. */
export function proseWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\d]+/u)
    .filter(Boolean);
}
