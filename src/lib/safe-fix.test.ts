import type { Rule } from "eslint";
import { runRuleTests } from "../testing/run-rule-tests.ts";
import { isDirectiveComment, removeComment } from "./safe-fix.ts";

/** A rule that deletes every comment that is not a directive with `removeComment`, to test the helper under both linters. */
const removeEveryComment: Rule.RuleModule = {
  meta: { type: "suggestion", fixable: "code", schema: [], messages: { comment: "comment" } },
  create(context) {
    const sourceCode = context.sourceCode;
    return {
      Program() {
        for (const comment of sourceCode.getAllComments()) {
          if (comment.type !== "Line" && comment.type !== "Block") continue;
          if (isDirectiveComment(comment)) continue;
          context.report({ loc: comment.loc!, messageId: "comment", fix: (fixer) => removeComment(fixer, sourceCode, comment) });
        }
      },
    };
  },
};

runRuleTests("safe-fix removeComment", removeEveryComment, {
  valid: ["// eslint-disable-next-line no-console\nconsole.log(1);", "const x = /* #__PURE__ */ make();", "/*! keep */\nrun();"],
  invalid: [
    {
      name: "a comment alone on its line goes with the line",
      code: "let r = 1\n// gone\n;[1, 2].forEach((x) => { r += x })",
      output: "let r = 1\n;[1, 2].forEach((x) => { r += x })",
      errors: 1,
      behaviour: "r",
    },
    {
      name: "a block comment with a line break between `return` and its value becomes a line break",
      code: "function f() { return /* a\n b */ 42 }",
      output: "function f() { return \n 42 }",
      errors: 1,
      behaviour: "f()",
    },
    {
      name: "a block comment holding U+2028 is a line break too",
      code: "function f() { return /* a\u2028b */ 43 }",
      output: "function f() { return \n 43 }",
      errors: 1,
      behaviour: "f()",
    },
    {
      name: "a block comment holding U+2029 is a line break too",
      code: "function f() { return /* a\u2029b */ 44 }",
      output: "function f() { return \n 44 }",
      errors: 1,
      behaviour: "f()",
    },
    {
      name: "a block comment holding a lone CR is a line break too",
      code: "function f() { return /* a\rb */ 45 }",
      output: "function f() { return \n 45 }",
      errors: 1,
      behaviour: "f()",
    },
    {
      name: "`return/*x*/value` keeps a space",
      code: "function f(value) { return/*x*/value }",
      output: "function f(value) { return value }",
      errors: 1,
      behaviour: "f(3)",
    },
    {
      name: "code only before: the blank space before goes too",
      code: "const a = 1; /* note */\nconst b = a;",
      output: "const a = 1;\nconst b = a;",
      errors: 1,
      behaviour: "b",
    },
    {
      name: "code only after: the blank space after goes too",
      code: "/* note */ const a = 1;",
      output: "const a = 1;",
      errors: 1,
      behaviour: "a",
    },
  ],
});
