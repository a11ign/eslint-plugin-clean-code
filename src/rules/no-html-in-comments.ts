import type { Rule } from "eslint";
import { defineRule } from "../lib/define-rule.ts";
import type { Comment } from "../lib/ast.ts";
import { isDirectiveComment } from "../lib/safe-fix.ts";
import { lineBreakOf, replaceCommentText, sourceComments } from "../lib/comment-text.ts";

/** The formatting tags CMT-09 names, in lower case only: `<T>` and `<B>` are type parameters, not HTML. */
const TAG = /<\/?(?:p|br|pre|code|b|i|em|strong|tt|ul|ol|li)(?:\s[^<>]*)?\/?>/g;
const ENTITY = /&(?:lt|gt|amp|quot|#39|nbsp);/g;
/** Tags that break a line or a block: removing one between two words leaves a space. */
const BLOCK_TAG = /^<\/?(?:p|br|pre|ul|ol|li)\b/;
const DECODED: Record<string, string> = { "&lt;": "<", "&gt;": ">", "&amp;": "&", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };

/** A capitalised element (`<List>`, `<Foo.Bar `): the line is a JSX example, so its tags and entities are JSX. */
const JSX_ELEMENT = /<\p{Lu}[\w.]*[\s/>]/u;

/** The tags found to be formatting so far, and the opening tags still waiting for their closing tag, by tag name. */
interface TagPairing {
  formatting: Set<RegExpExecArray>;
  open: Map<string, RegExpExecArray[]>;
}

/** Every tag-shaped text in `value`, formatting or not, to tell whether decoding an entity made a new one. */
const tagCount = (value: string) => [...value.matchAll(TAG)].length;

function reportHtml(context: Rule.RuleContext, comment: Comment): void {
  const found = htmlIn(comment.value);
  if (found.length === 0) return;
  const value = plainText(comment, found);
  const sourceCode = context.sourceCode;
  context.report({
    loc: comment.loc!,
    messageId: "html",
    data: { html: found[0][0] },
    ...(isOneLevelFix(comment, found, value) ? { fix: (fixer: Rule.RuleFixer) => replaceCommentText(fixer, sourceCode, comment, value) } : {}),
  });
}

/** The HTML formatting tags and the entities of `value`, outside its code and its JSX examples, in order. */
function htmlIn(value: string): RegExpExecArray[] {
  const code = codeRanges(value);
  const outside = (match: RegExpExecArray) => !code.some(([start, end]) => match.index >= start && match.index < end) && !onJsxLine(value, match.index);
  const tags = formattingTags([...value.matchAll(TAG)].filter(outside));
  const entities = [...value.matchAll(ENTITY)].filter(outside);
  return [...tags, ...entities].sort((left, right) => left.index - right.index);
}

/** The parts of a comment that show code, not formatting: an `@example` section, a fenced block and a backtick span. */
function codeRanges(value: string): [number, number][] {
  const ranges: [number, number][] = [];
  for (const match of value.matchAll(/@example\b[\s\S]*?(?=\n[ \t]*\*?[ \t]*@\w|$)|```[\s\S]*?(?:```|$)|`[^`\n]+`/g)) {
    ranges.push([match.index, match.index + match[0].length]);
  }
  return ranges;
}

function onJsxLine(value: string, index: number): boolean {
  const start = value.lastIndexOf("\n", index) + 1;
  const end = value.indexOf("\n", index);
  return JSX_ELEMENT.test(value.slice(start, end === -1 ? value.length : end));
}

/**
 * The formatting tags among `tags`: each opening tag with its matching closing tag (`<b>…</b>`, `<pre>…</pre>`), and the
 * tags that stand alone in HTML (`<br>`, `<p>`). A tag named in prose (`an <li>`) has no closing tag and is left alone.
 */
function formattingTags(tags: RegExpExecArray[]): RegExpExecArray[] {
  const pairing: TagPairing = { formatting: new Set(), open: new Map() };
  for (const tag of tags) pairTag(pairing, tag);
  return tags.filter((tag) => pairing.formatting.has(tag));
}

function pairTag(pairing: TagPairing, tag: RegExpExecArray): void {
  const name = /^<\/?(\w+)/.exec(tag[0])![1];
  if (isStandaloneTag(name, tag)) pairing.formatting.add(tag);
  if (tag[0].startsWith("</")) closeTag(pairing, name, tag);
  else if (!tag[0].endsWith("/>")) pairing.open.set(name, [...(pairing.open.get(name) ?? []), tag]);
}

/** `<br>`, `<br/>`, `</br>` and an opening `<p>`, which HTML lets stand alone. */
function isStandaloneTag(name: string, tag: RegExpExecArray): boolean {
  if (name === "br") return true;
  return name === "p" && !tag[0].startsWith("</");
}

/** Pairs the closing `tag` with the last opening tag of the same name, if there is one, and marks both as formatting. */
function closeTag(pairing: TagPairing, name: string, tag: RegExpExecArray): void {
  const opening = pairing.open.get(name)?.pop();
  if (opening) pairing.formatting.add(opening).add(tag);
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

function replacement(value: string, match: RegExpExecArray): string {
  const html = match[0];
  if (html.startsWith("&")) return DECODED[html];
  const before = value[match.index - 1] ?? " ";
  const after = value[match.index + html.length] ?? " ";
  return BLOCK_TAG.test(html) && /\S/.test(before) && /\S/.test(after) ? " " : "";
}

/** One level at a time: no fix when the decoded text is HTML again (`&amp;lt;`) or holds a new tag (`&lt;b&gt;`). */
function isOneLevelFix(comment: Comment, found: RegExpExecArray[], value: string): boolean {
  const removedTags = found.filter((match) => match[0].startsWith("<")).length;
  return htmlIn(value).length === 0 && tagCount(value) === tagCount(comment.value) - removedTags;
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
    return {
      Program() {
        for (const comment of sourceComments(context.sourceCode).filter((candidate) => !isDirectiveComment(candidate))) reportHtml(context, comment);
      },
    };
  },
});
