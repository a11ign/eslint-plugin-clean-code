import type { Rule, SourceCode } from "eslint";
import { defineRule } from "../lib/define-rule.ts";
import { asTs, type TSESTree } from "../lib/ast.ts";

type Statement = TSESTree.Statement;
type Expression = TSESTree.Expression;

const COMPARISON = new Set(["==", "!=", "===", "!==", "<", ">", "<=", ">=", "instanceof", "in"]);

/** The boolean literal a branch returns: `return true;`, or a block holding only that. */
function returnedBoolean(statement: Statement | null | undefined): boolean | null {
  const only = statement?.type === "BlockStatement" && statement.body.length === 1 ? statement.body[0] : statement;
  if (only?.type !== "ReturnStatement" || only.argument?.type !== "Literal") return null;
  return typeof only.argument.value === "boolean" ? only.argument.value : null;
}

/** Whether `expression` is a boolean by its syntax alone, so `return expression` gives exactly `true` or `false`. */
function isBooleanBySyntax(expression: Expression): boolean {
  if (expression.type === "Literal") return typeof expression.value === "boolean";
  if (expression.type === "UnaryExpression") return expression.operator === "!";
  if (expression.type === "BinaryExpression") return COMPARISON.has(expression.operator);
  if (expression.type === "LogicalExpression" && expression.operator !== "??") return isBooleanBySyntax(expression.left) && isBooleanBySyntax(expression.right);
  return false;
}

function returnText(sourceCode: SourceCode, test: Expression, inverse: boolean): string {
  const text = sourceCode.getText(test as never);
  if (inverse) return `return !(${text});`;
  return isBooleanBySyntax(test) ? `return ${text};` : `return !!(${text});`;
}

/** The comments inside the replaced statements, each on its own line above the new `return`. */
function keptComments(sourceCode: SourceCode, range: [number, number], indent: string): string {
  const inside = sourceCode.getAllComments().filter((comment) => comment.range![0] >= range[0] && comment.range![1] <= range[1]);
  return inside.map((comment) => `${sourceCode.getText(comment as never)}\n${indent}`).join("");
}

function indentOf(sourceCode: SourceCode, node: TSESTree.Node): string {
  const line = sourceCode.lines[node.loc.start.line - 1];
  return line.slice(0, line.length - line.trimStart().length);
}

/** The statement after `node` in its block, for the form whose `else` is left out. */
function nextStatement(node: TSESTree.IfStatement): Statement | null {
  const parent = node.parent;
  if (parent?.type !== "BlockStatement" && parent?.type !== "Program" && parent?.type !== "SwitchCase") return null;
  const siblings = (parent.type === "SwitchCase" ? parent.consequent : parent.body) as Statement[];
  return siblings[siblings.indexOf(node) + 1] ?? null;
}

export default defineRule({
  name: "return-boolean-directly",
  type: "suggestion",
  description: "Return a boolean expression directly instead of branching to `return true` and `return false`.",
  book: {
    entry: "CD-01",
    chapter: "21 Continuous Design § Return Boolean Expressions",
    passage: "We rarely say that things are flat-out wrong in programming, but this is one of those cases. Simply (and we don't use that word lightly) return the boolean expression",
  },
  fixable: "code",
  messages: {
    branchToBoolean: {
      problem: "This `if` returns `true` in one branch and `false` in the other.",
      refactor: "return the condition itself (`return {{suggestion}}`).",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    return {
      IfStatement(node) {
        const statement = asTs<TSESTree.IfStatement>(node);
        const whenTrue = returnedBoolean(statement.consequent);
        if (whenTrue === null) return;
        const otherwise = statement.alternate ?? nextStatement(statement);
        const whenFalse = returnedBoolean(otherwise);
        if (whenFalse === null || whenFalse === whenTrue || !otherwise) return;
        const range: [number, number] = [statement.range[0], otherwise.range[1]];
        const replacement = returnText(sourceCode, statement.test, !whenTrue);
        context.report({
          node,
          messageId: "branchToBoolean",
          data: { suggestion: replacement.slice("return ".length) },
          fix: (fixer: Rule.RuleFixer) => fixer.replaceTextRange(range, keptComments(sourceCode, range, indentOf(sourceCode, statement)) + replacement),
        });
      },
    };
  },
});
