import { defineRule } from "../lib/define-rule.ts";
import { asTs, type TSESTree } from "../lib/ast.ts";

type Options = [{ maxOperands?: number }];
type Expression = TSESTree.Expression;

const DEFAULT_MAX_OPERANDS = 3;

interface Shape {
  operators: Set<"&&" | "||">;
  operands: number;
}

/**
 * The `&&` and `||` operators a condition joins and how many operands they join. A `!` in front of a group is looked
 * through, so `!(a && b) || c` mixes both. `??`, calls and every other expression are one operand.
 */
function shapeOf(expression: Expression, shape: Shape = { operators: new Set(), operands: 0 }): Shape {
  if (expression.type === "LogicalExpression" && expression.operator !== "??") {
    shape.operators.add(expression.operator);
    shapeOf(expression.left, shape);
    shapeOf(expression.right, shape);
  } else if (expression.type === "UnaryExpression" && expression.operator === "!" && expression.argument.type === "LogicalExpression" && expression.argument.operator !== "??") {
    shapeOf(expression.argument, shape);
  } else {
    shape.operands += 1;
  }
  return shape;
}

export default defineRule<Options>({
  name: "no-complex-condition",
  type: "suggestion",
  description: "Extract a condition that mixes `&&` and `||`, or joins more than three operands, into a named predicate.",
  book: {
    entry: "ONE-04",
    chapter: "13 Clean Classes § Fixing the Problem",
    passage: "Those details don't make it clear why we're heading into a certain piece of code. An extracted predicate's method name can impart immediate understanding.",
  },
  messages: {
    mixed: {
      problem: "This `{{kind}}` condition mixes `&&` and `||`.",
      refactor: "extract the condition into a function (or a `const` before an `if`) whose name says what it means, such as `isEligibleForDiscount(order)`.",
    },
    tooManyOperands: {
      problem: "This `{{kind}}` condition joins {{count}} operands with `{{operator}}`, more than {{max}}.",
      refactor: "extract the condition into a function (or a `const` before an `if`) whose name says what it means, such as `isEligibleForDiscount(order)`.",
    },
  },
  schema: [
    {
      type: "object",
      properties: { maxOperands: { type: "integer", minimum: 1, default: DEFAULT_MAX_OPERANDS } },
      additionalProperties: false,
    },
  ],
  defaultOptions: [{ maxOperands: DEFAULT_MAX_OPERANDS }],
  create(context) {
    const max = (context.options[0] as Options[0] | undefined)?.maxOperands ?? DEFAULT_MAX_OPERANDS;
    function check(test: Expression | null | undefined, kind: string): void {
      if (!test) return;
      const shape = shapeOf(test);
      if (shape.operators.size > 1) {
        context.report({ node: test as never, messageId: "mixed", data: { kind } });
      } else if (shape.operands > max) {
        context.report({ node: test as never, messageId: "tooManyOperands", data: { kind, count: String(shape.operands), operator: [...shape.operators][0], max: String(max) } });
      }
    }
    return {
      IfStatement: (node) => check(asTs<TSESTree.IfStatement>(node).test, "if"),
      WhileStatement: (node) => check(asTs<TSESTree.WhileStatement>(node).test, "while"),
      DoWhileStatement: (node) => check(asTs<TSESTree.DoWhileStatement>(node).test, "do…while"),
      ConditionalExpression: (node) => check(asTs<TSESTree.ConditionalExpression>(node).test, "ternary"),
    };
  },
});
