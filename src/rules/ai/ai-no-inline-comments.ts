import { defineAiRule } from "../../lib/define-rule.ts";
import type { Comment } from "../../lib/ast.ts";
import { isDirectiveComment, isDocComment } from "../../lib/safe-fix.ts";
import { sourceComments } from "../../lib/comment-text.ts";

/** What marks the first comment of a file as its licence header. */
const LICENCE = /\b(copyright|licen[cs]ed?|SPDX-License-Identifier)\b|\(c\)|©/i;

/** The longest piece of a comment's text the message quotes. */
const QUOTE_LENGTH = 60;

interface Options {
  allow?: string[];
}

/** Whether the comment is the file's licence header: the first thing in the file, after a hashbang at most. */
function isLicenceHeader(comment: Comment, firstCodeStart: number, isFirst: boolean): boolean {
  return isFirst && comment.range![1] <= firstCodeStart && LICENCE.test(comment.value);
}

/** The comment's text on one line, cut to QUOTE_LENGTH characters. */
function quoted(comment: Comment): string {
  const text = comment.value.replace(/\s+/g, " ").trim();
  return text.length > QUOTE_LENGTH ? `${text.slice(0, QUOTE_LENGTH - 1)}…` : text;
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
    const isAllowed = (comment: Comment) => allow.some((pattern) => pattern.test(comment.value));
    return {
      Program(program) {
        const firstCodeStart = program.body[0]?.range?.[0] ?? sourceCode.text.length;
        sourceComments(sourceCode).forEach((comment, index) => {
          if (isDocComment(comment) || isDirectiveComment(comment) || isAllowed(comment)) return;
          if (isLicenceHeader(comment, firstCodeStart, index === 0)) return;
          context.report({ loc: comment.loc!, messageId: "comment", data: { text: quoted(comment) } });
        });
      },
    };
  },
});
