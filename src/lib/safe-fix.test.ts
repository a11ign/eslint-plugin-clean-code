import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Rule } from "eslint";
import { runRuleTests } from "../testing/run-rule-tests.ts";
import type { Token } from "./ast.ts";
import { continuesStatement, isDirectiveComment, removeComment, removeRange } from "./safe-fix.ts";

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
  valid: [
    "// eslint-disable-next-line no-console\nconsole.log(1);",
    "const x = /* #__PURE__ */ make();",
    "/*! keep */\nrun();",
    { name: "review: an inline source map is a directive", code: "export const a = 1;\n//# sourceMappingURL=data:application/json;base64,eyJ2/////ZXJz\n" },
    { name: "review: a sourceURL is a directive", code: "export const a = 1;\n//# sourceURL=a.js\n" },
    { name: "review: an old-style `//@ sourceMappingURL` is a directive", code: "export const a = 1;\n//@ sourceMappingURL=a.js.map\n" },
    { name: "review: a JetBrains language injection is a directive", code: "// language=SQL\nexport const d = 'select 1';" },
    { name: "review: a JetBrains noinspection is a directive", code: "// noinspection JSUnusedGlobalSymbols\nexport const m = 12;" },
  ],
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

/** A rule that removes every class member named `gone` with `removeRange`, to test the `;` guard under both linters. */
const removeGoneMembers: Rule.RuleModule = {
  meta: { type: "suggestion", fixable: "code", schema: [], messages: { gone: "gone" } },
  create(context) {
    const sourceCode = context.sourceCode;
    return {
      MethodDefinition(node) {
        if (node.key.type !== "Identifier" || node.key.name !== "gone") return;
        context.report({ node, messageId: "gone", fix: (fixer) => removeRange(fixer, sourceCode, node.range as [number, number]) });
      },
    };
  },
};

runRuleTests("safe-fix removeRange", removeGoneMembers, {
  valid: ["class A {\n  x = 2;\n  in() { return 1 }\n}"],
  invalid: [
    {
      name: "a field without `;` is continued by a member named `in`, so it gets a `;`",
      code: "class A {\n  x = 2\n  gone() {}\n  in() { return 1 }\n}",
      output: "class A {\n  x = 2\n  ;in() { return 1 }\n}",
      errors: 1,
      behaviour: ["new A().x", "new A().in()"],
    },
    {
      name: "a field without `;` is continued by a member named `instanceof`, so it gets a `;`",
      code: "class A {\n  x = 2\n  gone() {}\n  instanceof() { return 1 }\n}",
      output: "class A {\n  x = 2\n  ;instanceof() { return 1 }\n}",
      errors: 1,
      behaviour: ["new A().x", "new A().instanceof()"],
    },
  ],
});

describe("continuesStatement", () => {
  const token = (type: string, value: string) => ({ type, value }) as Token;
  it("treats `in` and `instanceof` after code without `;` as continuing it", () => {
    for (const type of ["Keyword", "Identifier"]) {
      assert.equal(continuesStatement(token("Numeric", "2"), token(type, "in")), true);
      assert.equal(continuesStatement(token("Identifier", "x"), token(type, "instanceof")), true);
    }
  });
  it("does not treat `in` after a `;` as continuing, nor a name that starts with `in`", () => {
    assert.equal(continuesStatement(token("Punctuator", ";"), token("Keyword", "in")), false);
    assert.equal(continuesStatement(token("Numeric", "2"), token("Identifier", "index")), false);
  });
});
