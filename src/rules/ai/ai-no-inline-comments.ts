import { defineAiRule } from "../../lib/define-rule.ts";
import type { Comment } from "../../lib/ast.ts";
import { isDirectiveComment, isDocComment } from "../../lib/safe-fix.ts";
import { sourceComments } from "../../lib/comment-text.ts";
import { shortQuote } from "../../lib/quote.ts";

/** What marks the first comment of a file as its licence header. */
const LICENCE = /\b(copyright|licen[cs]ed?|SPDX-License-Identifier)\b|\(c\)|©/i;

interface Options {
  allow?: string[];
}

/** The file's licence header: its first comment, when no code comes before it and it names a licence. A hashbang may precede it. */
function licenceHeader(comments: Comment[], firstCodeStart: number): Comment | undefined {
  const [first] = comments;
  return first && first.range![1] <= firstCodeStart && LICENCE.test(first.value) ? first : undefined;
}

/** Whether the rule leaves the comment alone: a JSDoc comment, a tool directive, or one an `allow` pattern matches. */
function isKept(comment: Comment, allow: RegExp[]): boolean {
  return isDocComment(comment) || isDirectiveComment(comment) || allow.some((pattern) => pattern.test(comment.value));
}

export default defineAiRule<[Options]>({
  name: "ai-no-inline-comments",
  type: "suggestion",
  description: "Say it in the code, not in a `//` or `/* */` comment: only `/** */` doc comments and tool directives stay.",
  pattern: {
    entry: "AI-01",
    name: "narrating comments",
    harm: "a comment that narrates what the code does goes stale as the code changes, and hides that a name or a function is missing.",
  },
  messages: {
    comment: {
      problem: "The comment \"{{text}}\" explains code that should explain itself.",
      refactor: "say it in the code: a clearer name, an extracted function named for what the comment says, a JSDoc on the declaration, or a doc file for what the code cannot say.",
    },
  },
  schema: [
    {
      type: "object",
      properties: { allow: { type: "array", items: { type: "string" }, uniqueItems: true } },
      additionalProperties: false,
    },
  ],
  defaultOptions: [{ allow: [] }],
  create(context) {
    const sourceCode = context.sourceCode;
    const allow = ((context.options[0] as Options | undefined)?.allow ?? []).map((pattern) => new RegExp(pattern, "u"));
    return {
      Program(program) {
        const comments = sourceComments(sourceCode);
        const header = licenceHeader(comments, program.body[0]?.range?.[0] ?? sourceCode.text.length);
        const narrating = comments.filter((comment) => comment !== header && !isKept(comment, allow));
        for (const comment of narrating) context.report({ loc: comment.loc!, messageId: "comment", data: { text: shortQuote(comment.value) } });
      },
    };
  },
});
