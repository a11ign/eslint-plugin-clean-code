import type { Rule } from "eslint";
import { defineRule } from "../lib/define-rule.ts";
import type { Comment } from "../lib/ast.ts";
import { isDirectiveComment, isDocComment } from "../lib/safe-fix.ts";
import { commentLines, joinLines, replaceCommentText, sourceComments, withoutLines, type CommentLine } from "../lib/comment-text.ts";

const DEFAULT_LENGTH = 5;
const RUN_CHARACTERS = new Set(["/", "*", "-", "=", "#"]);

interface Run {
  start: number;
  end: number;
}

/** Box-drawing characters (U+2500 to U+257F): the line is part of a diagram. */
const BOX_DRAWING = /[\u2500-\u257f]/;
const DIAGRAM_EDGE = new Set(["+", "|"]);

/** A comment with a banner: its lines, and the banner runs found on each line. */
interface Banner {
  comment: Comment;
  lines: CommentLine[];
  runs: Run[][];
  movedStar: boolean;
}

function reportBanner(context: Rule.RuleContext, comment: Comment, length: number): void {
  if (isDirectiveComment(comment)) return;
  const banner = findBanner(comment, length);
  if (!banner) return;
  context.report({
    loc: comment.loc!,
    messageId: "banner",
    data: describeFirstRun(banner),
    fix: (fixer) => replaceCommentText({ fixer, sourceCode: context.sourceCode }, comment, withoutBanner(banner)),
  });
}

/** The comment's banner runs, or null when it has none. */
function findBanner(comment: Comment, length: number): Banner | null {
  const { lines, movedStar } = linesOf(comment);
  const doc = isDocComment(comment);
  const runs = lines.map((_, index) => bannerRunsOnLine(lines, index, { doc, length }));
  return runs.some((found) => found.length > 0) ? { comment, lines, runs, movedStar } : null;
}

/**
 * The banner runs on one line. In a doc comment, a Markdown rule is not a banner, and neither is a run inside a Markdown
 * code span (`` `/****** Section ******\/` ``): that quotes code, as a doc comment about banners does.
 */
function bannerRunsOnLine(lines: CommentLine[], index: number, { doc, length }: { doc: boolean; length: number }): Run[] {
  if (!doc) return runsIn(lines[index].content, length);
  if (isMarkdownRule(lines, index, { doc })) return [];
  const text = lines[index].content;
  const spans = codeSpans(text);
  return runsIn(text, length).filter((run) => !spans.some((span) => span.start < run.start && run.end <= span.end));
}

/** The Markdown code spans of a line: from each opening backtick to its closing one. An unclosed backtick opens none. */
function codeSpans(text: string): Run[] {
  const ticks = [...text.matchAll(/`/g)].map((match) => match.index);
  const spans: Run[] = [];
  for (let index = 0; index + 1 < ticks.length; index += 2) spans.push({ start: ticks[index], end: ticks[index + 1] });
  return spans;
}

/** The length and the character of the first banner run, for the message. */
function describeFirstRun({ lines, runs }: Banner): { count: string; character: string } {
  const index = runs.findIndex((found) => found.length > 0);
  const first = runs[index][0];
  return { count: String(first.end - first.start), character: lines[index].content[first.start] };
}

/** The comment's text with its banner runs removed, and the lines that held only runs deleted. */
function withoutBanner({ comment, lines, runs, movedStar }: Banner): string {
  const rewritten = lines.map((line, index) => {
    const place = { first: index === 0, last: index === lines.length - 1, block: comment.type === "Block", movedStar };
    return runs[index].length === 0 ? line : rewriteLine(line, runs[index], place);
  });
  const emptied = new Set(rewritten.flatMap((line, index) => (runs[index].length > 0 && line.content === "" ? [index] : [])));
  return joinLines(comment, withoutLines(comment, rewritten, emptied));
}

/** The runs of one punctuation character in `text` at least `length` long that are banners. */
function runsIn(text: string, length: number): Run[] {
  if (isDiagramLine(text)) return [];
  return characterRuns(text).filter((run) => isBannerRun(text, run, length));
}

/** `text` cut into runs: each run of one of the punctuation characters, and each other character on its own. */
function characterRuns(text: string): Run[] {
  const runs: Run[] = [];
  for (let start = 0, end = 0; start < text.length; start = end) {
    end = runEnd(text, start);
    runs.push({ start, end });
  }
  return runs;
}

/** Where the run that starts at `start` ends: after the last repeat of a punctuation character, or after any other character. */
function runEnd(text: string, start: number): number {
  let end = start + 1;
  if (RUN_CHARACTERS.has(text[start])) while (text[end] === text[start]) end += 1;
  return end;
}

function isBannerRun(text: string, run: Run, length: number): boolean {
  return RUN_CHARACTERS.has(text[run.start]) && run.end - run.start >= length && !isNotBanner(text, run.start, run.end);
}

/**
 * Whether a run is not a banner: an arrow (`----->`, `<-----`), the edge of a diagram box (`+-----+`, `|=====|`), or
 * part of a longer token such as a URL or base64 (`eyJ2/////ZXJz`), with other characters right on both sides of it.
 */
function isNotBanner(text: string, start: number, end: number): boolean {
  const before = text[start - 1];
  const after = text[end];
  if (isArrowOrBoxEdge(before, after)) return true;
  return before !== undefined && after !== undefined && /\S/.test(before) && /\S/.test(after);
}

function isArrowOrBoxEdge(before: string, after: string): boolean {
  return isArrowHead(before, after) || DIAGRAM_EDGE.has(before) || DIAGRAM_EDGE.has(after);
}

/** Whether the run is the shaft of an arrow: `>` right after it, or `<` right before it. */
function isArrowHead(before: string, after: string): boolean {
  return after === ">" || before === "<";
}

/** Whether the line is part of an ASCII or box-drawing diagram: it starts or ends with `+` or `|`, or draws boxes. */
function isDiagramLine(text: string): boolean {
  const trimmed = text.trim();
  return BOX_DRAWING.test(trimmed) || DIAGRAM_EDGE.has(trimmed[0]) || DIAGRAM_EDGE.has(trimmed.at(-1)!);
}

/** A doc comment line that is only a run under a line of text (a Markdown heading underline), or a Markdown table rule. */
function isMarkdownRule(lines: CommentLine[], index: number, { doc }: { doc: boolean }): boolean {
  const text = lines[index].content.trim();
  const above = index > 0 ? lines[index - 1].content.trim() : "";
  if (!doc || above === "" || /^(.)\1*$/u.test(above)) return false;
  return /^(.)\1*$/u.test(text) || (text.includes("|") && above.includes("|") && /^[\s|:-]+$/.test(text));
}

/**
 * The comment's lines. In a block comment opening with `/**` that is not a doc comment (`/*******`), the first `*` is
 * moved into the decoration, so JSDoc's opening never counts towards a run.
 */
function linesOf(comment: Comment): { lines: CommentLine[]; movedStar: boolean } {
  const lines = commentLines(comment);
  const first = lines[0];
  const movedStar = comment.type === "Block" && !isDocComment(comment) && first.content.startsWith("*");
  if (movedStar) lines[0] = { prefix: `${first.prefix}*`, content: first.content.slice(1) };
  return { lines, movedStar };
}

interface LinePlace {
  first: boolean;
  last: boolean;
  block: boolean;
  movedStar: boolean;
}

/**
 * One line with its runs removed. Text that a run kept apart from the comment's delimiters stays one space away from
 * them, so `/****** Section ******\/` becomes `/* Section *\/` and `//===== Section` becomes `// Section`.
 */
function rewriteLine(line: CommentLine, runs: Run[], place: LinePlace): CommentLine {
  const content = withoutRuns(line.content, runs);
  if (content.trim() === "") return { ...line, content: "" };
  const prefix = place.first && runs[0].start === 0 ? openingPrefix(line.prefix, place) : line.prefix;
  const runsToClose = place.block && place.last && runs.at(-1)!.end >= line.content.trimEnd().length;
  return { prefix, content: runsToClose ? withTrailingSpace(content) : content };
}

/** The opening delimiter, without the `*` moved into the decoration, and one space after it. */
function openingPrefix(prefix: string, place: LinePlace): string {
  const opening = place.movedStar ? prefix.slice(0, -1) : prefix;
  return withTrailingSpace(opening);
}

function withTrailingSpace(text: string): string {
  return /[ \t]$/.test(text) ? text : `${text} `;
}

/** `content` with each run and the blank space around it removed, keeping one space between text on both sides. */
function withoutRuns(content: string, runs: Run[]): string {
  return runs.reduceRight((text, run) => {
    let left = run.start;
    let right = run.end;
    while (left > 0 && /[ \t]/.test(text[left - 1])) left -= 1;
    while (right < text.length && /[ \t]/.test(text[right])) right += 1;
    const before = text.slice(0, left);
    const after = text.slice(right);
    return before + (before.trim() !== "" && after.trim() !== "" ? " " : "") + after;
  }, content);
}

export default defineRule<[number]>({
  name: "no-position-markers",
  type: "suggestion",
  description: "Remove banner comments made of long runs of punctuation.",
  book: {
    entry: "CMT-07",
    chapter: "5 Comments § Position Markers",
    passage: "There are rare times when it makes sense to gather certain functions together beneath a banner like this. But in general, they are clutter that should be avoided-especially the noisy train of slashes at the end.",
  },
  fixable: "code",
  schema: [{ type: "integer", minimum: 2, default: DEFAULT_LENGTH }],
  defaultOptions: [DEFAULT_LENGTH],
  messages: {
    banner: {
      problem: "This comment is a position marker: a run of {{count}} `{{character}}` characters.",
      refactor: "remove the banner; if the functions below it belong together, let their names and order show it, or move them into their own module.",
    },
  },
  create(context) {
    const length = (context.options[0] as number | undefined) ?? DEFAULT_LENGTH;
    return {
      Program() {
        for (const comment of sourceComments(context.sourceCode)) reportBanner(context, comment, length);
      },
    };
  },
});
