import type { SourceCode } from "eslint";
import { defineAiRule } from "../../lib/define-rule.ts";
import { asTs, type TSESTree } from "../../lib/ast.ts";

/**
 * One emoji as a reader sees it: a character shown as an emoji by default (`✅`, `🚀`), or a pictographic character asked to
 * show as one with U+FE0F (`⚠️`), a keycap (`1️⃣`) or a flag, with any skin-tone modifiers and `‍`-joined parts after it.
 * A pictographic character with no U+FE0F (`©`, `™`, `↔`, `✔`) shows as text, and arrows and marks such as `→` and `✓`
 * are not pictographic at all, so none of them is reported.
 */
const EMOJI = /(?:\p{RI}\p{RI}|[#*0-9]️?⃣|\p{Emoji_Presentation}|\p{Extended_Pictographic}️)(?:\p{EMod}|️|‍(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}️?))*/gu;

interface Options {
  allow?: string[];
  checkJsxText?: boolean;
}

/** An emoji without its U+FE0F, so an `allow` entry matches it written either way. */
function bare(emoji: string): string {
  return emoji.replaceAll("️", "");
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
    const sourceCode: SourceCode = context.sourceCode;
    const options = (context.options[0] as Options | undefined) ?? {};
    const allowed = new Set((options.allow ?? []).map(bare));

    /** Reports each emoji in the source text between `start` and `end`. */
    function checkRange(start: number, end: number) {
      for (const match of sourceCode.text.slice(start, end).matchAll(EMOJI)) {
        if (allowed.has(bare(match[0]))) continue;
        const offset = start + match.index;
        const loc = { start: sourceCode.getLocFromIndex(offset), end: sourceCode.getLocFromIndex(offset + match[0].length) };
        context.report({ loc, messageId: "emoji", data: { emoji: match[0] } });
      }
    }
    const checkNode = (node: unknown) => {
      const [start, end] = asTs(node).range;
      checkRange(start, end);
    };

    return {
      Program() {
        for (const comment of sourceCode.getAllComments()) checkRange(comment.range![0], comment.range![1]);
      },
      Literal(node) {
        if (typeof asTs<TSESTree.Literal>(node).value === "string") checkNode(node);
      },
      TemplateElement: checkNode,
      ...(options.checkJsxText ? { JSXText: checkNode } : {}),
    };
  },
});
