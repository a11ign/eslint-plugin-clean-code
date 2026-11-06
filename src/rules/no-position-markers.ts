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

/** Whether the line is part of an ASCII or box-drawing diagram: it starts or ends with `+` or `|`, or draws boxes. */
function isDiagramLine(text: string): boolean {
  const trimmed = text.trim();
  return BOX_DRAWING.test(trimmed) || DIAGRAM_EDGE.has(trimmed[0]) || DIAGRAM_EDGE.has(trimmed.at(-1)!);
}

/**
 * Whether a run is not a banner: an arrow (`----->`, `<-----`), the edge of a diagram box (`+-----+`, `|=====|`), or
 * part of a longer token such as a URL or base64 (`eyJ2/////ZXJz`), with other characters right on both sides of it.
 */
function isNotBanner(text: string, start: number, end: number): boolean {
  const before = text[start - 1];
  const after = text[end];
  if (after === ">" || before === "<" || DIAGRAM_EDGE.has(before) || DIAGRAM_EDGE.has(after)) return true;
  return before !== undefined && after !== undefined && /\S/.test(before) && /\S/.test(after);
}

/** The runs of one punctuation character in `text` at least `length` long that are banners. */
function runsIn(text: string, length: number): Run[] {
  if (isDiagramLine(text)) return [];
  const runs: Run[] = [];
  for (let start = 0; start < text.length; ) {
    let end = start + 1;
    if (RUN_CHARACTERS.has(text[start])) while (text[end] === text[start]) end += 1;
    if (RUN_CHARACTERS.has(text[start]) && end - start >= length && !isNotBanner(text, start, end)) runs.push({ start, end });
    start = end;
  }
  return runs;
}

/** A doc comment line that is only a run under a line of text (a Markdown heading underline), or a Markdown table rule. */
function isMarkdownRule(lines: CommentLine[], index: number, doc: boolean): boolean {
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
  let content = withoutRuns(line.content, runs);
  if (content.trim() === "") return { ...line, content: "" };
  let prefix = line.prefix;
  if (place.first && runs[0].start === 0) {
    if (place.movedStar) prefix = prefix.slice(0, -1);
    if (!/[ \t]$/.test(prefix)) prefix += " ";
  }
  if (place.block && place.last && runs.at(-1)!.end >= line.content.trimEnd().length && !/[ \t]$/.test(content)) content += " ";
  return { prefix, content };
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
    const sourceCode = context.sourceCode;
    const length = (context.options[0] as number | undefined) ?? DEFAULT_LENGTH;
    return {
      Program() {
        for (const comment of sourceComments(sourceCode)) {
          if (isDirectiveComment(comment)) continue;
          const { lines, movedStar } = linesOf(comment);
          const runs = lines.map((line, index) => (isMarkdownRule(lines, index, isDocComment(comment)) ? [] : runsIn(line.content, length)));
          const first = runs.flat()[0];
          if (!first) continue;
          const firstLine = lines[runs.findIndex((found) => found.length > 0)];
          const rewritten = lines.map((line, index) => {
            const place = { first: index === 0, last: index === lines.length - 1, block: comment.type === "Block", movedStar };
            return runs[index].length === 0 ? line : rewriteLine(line, runs[index], place);
          });
          const emptied = new Set(rewritten.flatMap((line, index) => (runs[index].length > 0 && line.content === "" ? [index] : [])));
          context.report({
            loc: comment.loc!,
            messageId: "banner",
            data: { count: String(first.end - first.start), character: firstLine.content[first.start] },
            fix: (fixer) => replaceCommentText(fixer, sourceCode, comment, joinLines(comment, withoutLines(comment, rewritten, emptied))),
          });
        }
      },
    };
  },
});
