import type { Rule, SourceCode } from "eslint";
import { defineRule } from "../lib/define-rule.ts";
import type { Comment } from "../lib/ast.ts";
import { isDirectiveComment } from "../lib/safe-fix.ts";
import { commentGroups, commentLines, groupLocation, joinLines, keepInRun, replaceCommentText, withoutLines } from "../lib/comment-text.ts";

const DEFAULT_DATED_LINES = 3;

/** A date (`2024-01-31`, `31-Jan-2024`, `1/31/2024`) at the start of a line, then `:` or `-`. */
const DATED_LINE = /^(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}-\p{L}{3,9}-\d{2,4}|\d{1,2}\/\d{1,2}\/\d{2,4})[ \t]*[:-]/u;

const indentation = (text: string) => /^[ \t]*/.exec(text)![0].length;

/** Words that say an entry records a change, not a fact about a date (a holiday, a date format). */
const CHANGE_WORD = /\b(?:add(?:ed|s)?|fix(?:ed|es)?|chang(?:ed|es)|remov(?:ed|es)|mov(?:ed|es)|renam(?:ed|es)|updat(?:ed|es)|refactor(?:ed|s)?|re-?organi[sz](?:ed|es)|initial|creat(?:ed|es)|delet(?:ed|es)|implement(?:ed|s)|improv(?:ed|es)|merg(?:ed|es)|releas(?:ed|es)|replac(?:ed|es)|rewr(?:ote|itten)|deprecat(?:ed|es)|clean(?:ed|s)? up|split|extract(?:ed|s)|eliminat(?:ed|es)|requires)\b/i;
/** An author's initials (`(DG)`) or name (`by Ada Lovelace`) at an entry. */
const AUTHOR = /\((?:[A-Z]{2,4})\)|\bby[ \t]+\p{Lu}\p{L}+/u;
/** A header that names a change log. A list under any other header (`Holidays observed:`) is not a journal. */
const JOURNAL_HEADER = /\b(?:change|history|log\b|revision|journal|modification)/i;

interface Line {
  indent: number;
  content: string;
}

/**
 * The entries of a change log in the comment: each dated line whose entry reads as a change, with the lines that
 * continue the entry (the lines right after it that are indented further than its date and are not dated). None when
 * the text line above the first dated line is a header that names something other than a change log.
 */
function journalEntries(lines: Line[]): number[][] {
  const entries: number[][] = [];
  let entryIndent: number | null = null;
  lines.forEach((line, index) => {
    const text = line.content.trim();
    if (DATED_LINE.test(text)) {
      entries.push([index]);
      entryIndent = line.indent;
    } else if (entryIndent !== null && text !== "" && line.indent > entryIndent) {
      entries.at(-1)!.push(index);
    } else {
      entryIndent = null;
    }
  });
  if (entries.length === 0) return [];
  const header = lines.slice(0, entries[0][0]).map((line) => line.content.trim()).filter(Boolean).at(-1);
  if (header !== undefined && !JOURNAL_HEADER.test(header)) return [];
  return entries.filter((entry) => {
    const text = entry.map((index) => lines[index].content).join(" ");
    return CHANGE_WORD.test(text) || AUTHOR.test(text);
  });
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
          const journal = journalEntries(lines);
          if (journal.length < threshold) continue;
          const dated = journal.length;
          const entries = new Set(journal.flat());
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
