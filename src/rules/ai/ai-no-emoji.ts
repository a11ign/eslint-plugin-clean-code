import { defineAiRule } from "../../lib/define-rule.ts";
import type { Rule, SourceCode } from "eslint";
import { asTs, type TSESTree } from "../../lib/ast.ts";

type Range = readonly [number, number];

/**
 * One emoji as a reader sees it: a character shown as an emoji by default (`\u{2705}`, `\u{1F680}`), or a pictographic
 * character asked to show as one with U+FE0F (`\u{26A0}\u{FE0F}`), a keycap (`1\u{FE0F}\u{20E3}`) or a flag, with any
 * skin-tone modifiers and U+200D-joined parts after it. Emoji are written here as escapes so this file passes its own rule.
 * A pictographic character with no U+FE0F (`©`, `™`, `↔`, `✔`) shows as text, and arrows and marks such as `→` and `✓`
 * are not pictographic at all, so none of them is reported.
 */
const EMOJI = /(?:\p{RI}\p{RI}|[#*0-9]️?⃣|\p{Emoji_Presentation}|\p{Extended_Pictographic}️)(?:\p{EMod}|️|‍(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}️?))*/gu;

interface Options {
  allow?: string[];
  checkJsxText?: boolean;
}

export default defineAiRule<[Options]>({
  name: "ai-no-emoji",
  type: "suggestion",
  description: "Keep emoji out of comments, strings and log messages.",
  pattern: {
    entry: "AI-04",
    name: "emoji in code",
    harm: "emoji in logs and comments add no information, break log search and grep, and render as boxes in terminals and log viewers that lack the font.",
  },
  messages: {
    emoji: {
      problem: "The emoji \"{{emoji}}\" is decoration, not information.",
      refactor: "delete it, or say in words what it meant (`done`, `failed`, `warning`); a symbol a reader needs belongs in the UI, with `checkJsxText` left off.",
    },
  },
  schema: [
    {
      type: "object",
      properties: {
        allow: { type: "array", items: { type: "string" }, uniqueItems: true },
        checkJsxText: { type: "boolean" },
      },
      additionalProperties: false,
    },
  ],
  defaultOptions: [{ allow: [], checkJsxText: false }],
  create(context) {
    const options = (context.options[0] as Options | undefined) ?? {};
    const allowed = new Set((options.allow ?? []).map(bare));
    return commentAndStringVisitors(context.sourceCode, (range) => reportEmojiIn(context, allowed, range), options);
  },
});

/**
 * Hands the range of every comment of `sourceCode`, string literal and template literal part (and JSX text, when
 * `options` turn on `checkJsxText`) to `checkRange`.
 */
function commentAndStringVisitors(sourceCode: SourceCode, checkRange: (range: Range) => void, options: Options): Rule.RuleListener {
  const checkNode = (node: unknown) => checkRange(asTs(node).range);
  return {
    Program: () => sourceCode.getAllComments().forEach((comment) => checkRange(comment.range!)),
    Literal(node) {
      if (typeof asTs<TSESTree.Literal>(node).value === "string") checkNode(node);
    },
    TemplateElement: checkNode,
    ...(options.checkJsxText ? { JSXText: checkNode } : {}),
  };
}

/** Reports through `context` each emoji in the source text in `range`, except those `allowed` lists. */
function reportEmojiIn(context: Rule.RuleContext, allowed: ReadonlySet<string>, range: Range) {
  const [start, end] = range;
  const matches = context.sourceCode.text.slice(start, end).matchAll(EMOJI);
  for (const match of matches) {
    if (!allowed.has(bare(match[0]))) reportEmojiAt(context, start + match.index, match[0]);
  }
}

/** `emoji` without its U+FE0F, so an `allow` entry matches it written either way. */
function bare(emoji: string): string {
  return emoji.replaceAll("️", "");
}

/** Reports through `context` the `emoji` that starts at `offset` in the source text. */
function reportEmojiAt(context: Rule.RuleContext, offset: number, emoji: string) {
  const sourceCode = context.sourceCode;
  const loc = { start: sourceCode.getLocFromIndex(offset), end: sourceCode.getLocFromIndex(offset + emoji.length) };
  context.report({ loc, messageId: "emoji", data: { emoji } });
}
