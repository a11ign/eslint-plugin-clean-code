import type { SourceCode } from "eslint";
import { defineRule } from "../lib/define-rule.ts";
import { asTs, type Comment, type TSESTree } from "../lib/ast.ts";
import { isDirectiveComment } from "../lib/safe-fix.ts";
import { disablingNode, readTestCall, type TestCall } from "../lib/test-calls.ts";

/** The node a reason comment sits above: the statement the call is, through an `await`, or the call itself. */
function commentedNode(call: TSESTree.CallExpression): TSESTree.Node {
  let node: TSESTree.Node = call;
  while (node.parent?.type === "AwaitExpression" || (node.parent?.type === "ExpressionStatement" && node.parent.expression === node)) node = node.parent;
  return node;
}

/** Whether a comment says something: it is not a tool directive and has words in it. */
function givesReason(comment: Comment): boolean {
  return !isDirectiveComment(comment) && /\p{L}{2,}/u.test(comment.value);
}

/**
 * Whether a comment directly before the call gives a reason. The comments that touch the call, each on the line after
 * the one before it (no blank line between), are read from the call upwards; a directive among them is skipped.
 */
function hasReasonComment(sourceCode: SourceCode, call: TSESTree.CallExpression): boolean {
  const node = commentedNode(call);
  const comments = sourceCode.getCommentsBefore(node as never) as Comment[];
  let nextLine = node.loc.start.line;
  for (let index = comments.length - 1; index >= 0; index -= 1) {
    const comment = comments[index];
    if (comment.loc!.end.line < nextLine - 1) return false;
    if (givesReason(comment)) return true;
    nextLine = comment.loc!.start.line;
  }
  return false;
}

/** How the report names what turned the test off. */
function formOf(test: TestCall, disabling: TSESTree.Node): string {
  if (disabling === test.base) return test.base.name;
  if (disabling.type === "Property") return "skip: true";
  return `${test.base.name}.skip`;
}

export default defineRule({
  name: "no-disabled-tests",
  type: "problem",
  description: "Don't turn failing tests off; a test that must stay off carries its reason in a comment.",
  book: {
    entry: "TST-07",
    chapter: "31 Small Cycles § Continuous Build",
    passage: "The more you ignore those failures, the more annoying the failure alerts become. And the more tempted you are to turn the failing tests off until you can fix them-later.",
  },
  messages: {
    disabled: {
      problem: "`{{form}}` turns this {{what}} off with no comment saying why, so whatever it would catch now goes unreported.",
      refactor: "make the test pass and remove `{{form}}`; if it must stay off for now, put the reason in a comment directly above the call, as JUnit's `@Ignore(\"Takes too long to run\")` does.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    return {
      CallExpression(node) {
        const test = readTestCall(node);
        if (!test) return;
        const disabling = disablingNode(test);
        if (!disabling || hasReasonComment(sourceCode, test.call)) return;
        context.report({
          node: asTs(disabling) as never,
          messageId: "disabled",
          data: { form: formOf(test, disabling), what: test.kind === "describe" ? "group of tests" : "test" },
        });
      },
    };
  },
});
