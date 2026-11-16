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

/** Reports a comment group that is a change log of at least `threshold` entries. */
function reportJournal(context: Rule.RuleContext, group: Comment[], threshold: number): void {
  if (isDirectiveComment(group[0])) return;
  const journal = journalEntries(groupLines(group));
  if (journal.length < threshold) return;
  const entries = new Set(journal.flat());
  context.report({
    loc: groupLocation(group),
    messageId: "journal",
    data: { count: String(journal.length) },
    fix: journalFix(context.sourceCode, group, entries),
  });
}

function groupLines(group: Comment[]): Line[] {
  return group[0].type === "Block" ? blockLines(group[0]) : runLines(group);
}

/**
 * The entries of a change log in the comment: each dated line whose entry reads as a change, with the lines that
 * continue the entry (the lines right after it that are indented further than its date and are not dated). None when
 * the text line above the first dated line is a header that names something other than a change log.
 */
function journalEntries(lines: Line[]): number[][] {
  const entries = datedEntries(lines);
  if (entries.length === 0 || !isUnderJournalHeader(lines, entries[0][0])) return [];
  return entries.filter((entry) => recordsChange(lines, entry));
}

/** Each dated line, with the lines that continue its entry. */
function datedEntries(lines: Line[]): number[][] {
  const collector = new EntryCollector();
  lines.forEach((line, index) => collector.add(line, index));
  return collector.entries;
}

/** Collects the dated entries line by line, remembering the indent of the date of the entry that is still open. */
class EntryCollector {
  readonly entries: number[][] = [];
  private openIndent: number | null = null;

  add(line: Line, index: number): void {
    const text = line.content.trim();
    if (DATED_LINE.test(text)) {
      this.entries.push([index]);
      this.openIndent = line.indent;
    } else if (this.openIndent !== null && text !== "" && line.indent > this.openIndent) {
      this.entries.at(-1)!.push(index);
    } else {
      this.openIndent = null;
    }
  }
}

/** True when there is no text line above the first dated line, or that line is a header that names a change log. */
function isUnderJournalHeader(lines: Line[], firstDated: number): boolean {
  const header = lines.slice(0, firstDated).map((line) => line.content.trim()).filter(Boolean).at(-1);
  return header === undefined || JOURNAL_HEADER.test(header);
}

function recordsChange(lines: Line[], entry: number[]): boolean {
  const text = entry.map((index) => lines[index].content).join(" ");
  return CHANGE_WORD.test(text) || AUTHOR.test(text);
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

/** Deletes the entries' lines from the block comment, or the entries' comments from the run of line comments. */
function journalFix(sourceCode: SourceCode, group: Comment[], entries: Set<number>): Rule.ReportFixer {
  if (group[0].type !== "Block") return (fixer) => keepInRun({ fixer, sourceCode }, group, (_, index) => !entries.has(index));
  const comment = group[0];
  return (fixer) => replaceCommentText({ fixer, sourceCode }, comment, joinLines(comment, withoutLines(comment, commentLines(comment), entries)));
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
    const threshold = (context.options[0] as number | undefined) ?? DEFAULT_DATED_LINES;
    return {
      Program() {
        for (const group of commentGroups(context.sourceCode, isDirectiveComment)) reportJournal(context, group, threshold);
      },
    };
  },
});
