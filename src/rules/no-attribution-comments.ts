import type { Rule } from "eslint";
import { defineRule } from "../lib/define-rule.ts";
import type { Comment } from "../lib/ast.ts";
import { isDirectiveComment, removeComment } from "../lib/safe-fix.ts";
import { commentLines, sourceComments } from "../lib/comment-text.ts";

const WORD = String.raw`\p{Lu}[\p{L}'’-]*\.?`;
/** Two or more capitalised words, an email or an `@handle`. One word is a tool or a class (`Created by ConnectionPool`), not a person. */
const PERSON = String.raw`(?:${WORD}(?:[ \t]+${WORD})+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+|@[\w-]+)`;
const DATE = String.raw`(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}-\p{L}{3,9}-\d{2,4}|\d{1,2}\/\d{1,2}\/\d{2,4})`;

/** `Added by`, `Created by` or `Modified by`, a person, then the end of the line or a date. */
const BYLINE = new RegExp(String.raw`\b(?:[Aa]dded|[Cc]reated|[Mm]odified)[ \t]+by[ \t]+${PERSON}[ \t]*(?:[,;:(-]?[ \t]*(?:on[ \t]+)?${DATE}\)?[ \t]*)?\.?[ \t]*$`, "u");
const LEADING_BYLINE = new RegExp(String.raw`^${BYLINE.source}`, "u");
const AUTHOR_TAG = /(?:^|\s)@author\b/;

function isByline(text: string): boolean {
  return AUTHOR_TAG.test(text) || BYLINE.test(text);
}

/** Whether every line of the comment with text on it is a byline, so deleting the comment loses nothing else. */
function isOnlyBylines(comment: Comment): boolean {
  const lines = commentLines(comment).map((line) => line.content.trim()).filter(Boolean);
  return lines.every((line) => /^@author\b/.test(line) || LEADING_BYLINE.test(line));
}

export default defineRule({
  name: "no-attribution-comments",
  type: "suggestion",
  description: "Delete bylines and `@author` tags; version control records who changed what.",
  book: {
    entry: "CMT-08",
    chapter: "5 Comments § Attributions and Bylines",
    passage: "Source code control systems are very good at remembering who added what, when. There is no need to pollute the code with little bylines.",
  },
  fixable: "code",
  messages: {
    byline: {
      problem: "This comment records who wrote or changed the code.",
      refactor: "delete the byline; `git blame` and `git log` already remember who added what, and when.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    return {
      Program() {
        for (const comment of sourceComments(sourceCode)) {
          if (isDirectiveComment(comment)) continue;
          if (!commentLines(comment).some((line) => isByline(line.content.trim()))) continue;
          context.report({
            loc: comment.loc!,
            messageId: "byline",
            ...(isOnlyBylines(comment) ? { fix: (fixer: Rule.RuleFixer) => removeComment(fixer, sourceCode, comment) } : {}),
          });
        }
      },
    };
  },
});
