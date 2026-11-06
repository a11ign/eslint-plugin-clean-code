import type { Rule, SourceCode } from "eslint";
import { defineRule } from "../lib/define-rule.ts";
import type { Comment } from "../lib/ast.ts";
import { isDirectiveComment } from "../lib/safe-fix.ts";
import { commentGroups, commentLines, groupLocation, joinLines, keepInRun, replaceCommentText, withoutLines } from "../lib/comment-text.ts";

const DEFAULT_DATED_LINES = 3;

/** A date (`2024-01-31`, `31-Jan-2024`, `1/31/2024`) at the start of a line, then `:` or `-`. */
const DATED_LINE = /^(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}-\p{L}{3,9}-\d{2,4}|\d{1,2}\/\d{1,2}\/\d{2,4})[ \t]*[:-]/u;

const indentation = (text: string) => /^[ \t]*/.exec(text)![0].length;

/**
 * The indexes of the dated lines, each with the lines that continue its entry: the lines right after it that are
 * indented further than its date and are not dated themselves.
 */
function journalLines(lines: { indent: number; content: string }[]): { dated: number; entries: Set<number> } {
  const entries = new Set<number>();
  let dated = 0;
  let entryIndent: number | null = null;
  lines.forEach((line, index) => {
    if (DATED_LINE.test(line.content.trim())) {
      dated += 1;
      entries.add(index);
      entryIndent = line.indent;
    } else if (entryIndent !== null && line.content.trim() !== "" && line.indent > entryIndent) {
      entries.add(index);
    } else {
      entryIndent = null;
    }
  });
  return { dated, entries };
}

/** A block comment's lines, each with the column its text starts at, so that entries and their continuations compare. */
function blockLines(comment: Comment) {
  const opening = comment.loc!.start.column + 2;
  return commentLines(comment).map((line, index) => ({
    indent: (index === 0 ? opening : 0) + line.prefix.length + indentation(line.content),
    content: line.content,
  }));
}

/** A run of line comments, each with the column its text starts at. */
function runLines(run: Comment[]) {
  return run.map((comment) => ({ indent: comment.loc!.start.column + 2 + indentation(comment.value), content: comment.value }));
}

function blockFix(fixer: Rule.RuleFixer, sourceCode: SourceCode, comment: Comment, entries: Set<number>): Rule.Fix | null {
  const lines = commentLines(comment);
  return replaceCommentText(fixer, sourceCode, comment, joinLines(comment, withoutLines(comment, lines, entries)));
}

export default defineRule<[number]>({
  name: "no-journal-comments",
  type: "suggestion",
  description: "Delete change-log comments; version control keeps the history.",
  book: {
    entry: "CMT-06",
    chapter: "5 Comments § Journal Comments",
    passage: "Nowadays, however, these long journals are just more clutter to obfuscate the module. They should be completely removed. Let the source code control system keep the journal for you.",
  },
  fixable: "code",
  schema: [{ type: "integer", minimum: 1, default: DEFAULT_DATED_LINES }],
  defaultOptions: [DEFAULT_DATED_LINES],
  messages: {
    journal: {
      problem: "This comment is a change log of {{count}} dated entries.",
      refactor: "delete the entries and let the source code control system keep the journal (`git log` has every change, its date and its author).",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const threshold = (context.options[0] as number | undefined) ?? DEFAULT_DATED_LINES;
    return {
      Program() {
        for (const group of commentGroups(sourceCode, isDirectiveComment)) {
          if (isDirectiveComment(group[0])) continue;
          const block = group[0].type === "Block";
          const lines = block ? blockLines(group[0]) : runLines(group);
          const { dated, entries } = journalLines(lines);
          if (dated < threshold) continue;
          context.report({
            loc: groupLocation(group),
            messageId: "journal",
            data: { count: String(dated) },
            fix: (fixer) => (block ? blockFix(fixer, sourceCode, group[0], entries) : keepInRun(fixer, sourceCode, group, (_, index) => !entries.has(index))),
          });
        }
      },
    };
  },
});
