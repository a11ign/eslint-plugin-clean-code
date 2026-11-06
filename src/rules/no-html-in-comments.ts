import type { Rule } from "eslint";
import { defineRule } from "../lib/define-rule.ts";
import type { Comment } from "../lib/ast.ts";
import { isDirectiveComment } from "../lib/safe-fix.ts";
import { lineBreakOf, replaceCommentText, sourceComments } from "../lib/comment-text.ts";

/** The formatting tags CMT-09 names, in lower case only: `<T>` and `<B>` are type parameters, not HTML. */
const TAG = /<\/?(?:p|br|pre|code|b|i|em|strong|tt|ul|ol|li)(?:\s[^<>]*)?\/?>/g;
const ENTITY = /&(?:lt|gt|amp|quot|#39|nbsp);/g;
const HTML = new RegExp(`${TAG.source}|${ENTITY.source}`, "g");
/** Tags that break a line or a block: removing one between two words leaves a space. */
const BLOCK_TAG = /^<\/?(?:p|br|pre|ul|ol|li)\b/;
const DECODED: Record<string, string> = { "&lt;": "<", "&gt;": ">", "&amp;": "&", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };

/** The parts of a comment that show code, not formatting: an `@example` section, a fenced block and a backtick span. */
function codeRanges(value: string): [number, number][] {
  const ranges: [number, number][] = [];
  for (const match of value.matchAll(/@example\b[\s\S]*?(?=\n[ \t]*\*?[ \t]*@\w|$)|```[\s\S]*?(?:```|$)|`[^`\n]+`/g)) {
    ranges.push([match.index, match.index + match[0].length]);
  }
  return ranges;
}

/** The HTML tags and entities of `value` outside its code. */
function htmlIn(value: string): RegExpExecArray[] {
  const code = codeRanges(value);
  return [...value.matchAll(HTML)].filter((match) => !code.some(([start, end]) => match.index >= start && match.index < end));
}

function replacement(value: string, match: RegExpExecArray): string {
  const html = match[0];
  if (html.startsWith("&")) return DECODED[html];
  const before = value[match.index - 1] ?? " ";
  const after = value[match.index + html.length] ?? " ";
  return BLOCK_TAG.test(html) && /\S/.test(before) && /\S/.test(after) ? " " : "";
}

/** The comment's text with its tags removed and its entities decoded, one level, with the blank space left at line ends trimmed. */
function plainText(comment: Comment, found: RegExpExecArray[]): string {
  let value = comment.value;
  for (const match of [...found].reverse()) {
    value = value.slice(0, match.index) + replacement(value, match) + value.slice(match.index + match[0].length);
  }
  const lineBreak = lineBreakOf(comment);
  const lines = value.split(lineBreak);
  const original = comment.value.split(lineBreak);
  const last = lines.length - 1;
  return lines.map((line, index) => (line !== original[index] && !(comment.type === "Block" && index === last) ? line.trimEnd() : line)).join(lineBreak);
}

export default defineRule({
  name: "no-html-in-comments",
  type: "suggestion",
  description: "Write comments as plain text, without HTML tags or entities.",
  book: {
    entry: "CMT-09",
    chapter: "5 Comments § HTML Comments",
    passage: "If comments are going to be extracted by some tool (like Javadoc) to appear in a nicely formatted document, then it should be the responsibility of that tool, and not the programmer, to adorn the comments with appropriate formatting.",
  },
  fixable: "code",
  messages: {
    html: {
      problem: "This comment is formatted with HTML (`{{html}}`), which makes it hard to read in the source.",
      refactor: "write it as plain text (or Markdown, which the documentation tool renders); leave the formatting to the tool.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    return {
      Program() {
        for (const comment of sourceComments(sourceCode)) {
          if (isDirectiveComment(comment)) continue;
          const found = htmlIn(comment.value);
          if (found.length === 0) continue;
          const value = plainText(comment, found);
          // One level at a time: when the decoded text is HTML again (`&amp;lt;`, `&lt;b&gt;`), a second pass would change it again.
          const fixable = htmlIn(value).length === 0;
          context.report({
            loc: comment.loc!,
            messageId: "html",
            data: { html: found[0][0] },
            ...(fixable ? { fix: (fixer: Rule.RuleFixer) => replaceCommentText(fixer, sourceCode, comment, value) } : {}),
          });
        }
      },
    };
  },
});
