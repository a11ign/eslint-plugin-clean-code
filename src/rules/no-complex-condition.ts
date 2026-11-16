import type { Rule } from "eslint";
import { defineRule } from "../lib/define-rule.ts";
import { asTs, type TSESTree } from "../lib/ast.ts";

type Options = [{ maxOperands?: number }];
type Expression = TSESTree.Expression;

const DEFAULT_MAX_OPERANDS = 3;

interface Shape {
  operators: Set<"&&" | "||">;
  operands: number;
}

/** An `&&` or `||` expression; `??` joins values, not conditions. */
type AndOr = TSESTree.LogicalExpression & { operator: "&&" | "||" };

/** Reports `test` when it mixes `&&` and `||` or joins more than `max` operands; `kind` names the statement it belongs to. */
type ConditionCheck = (test: Expression | null | undefined, kind: string) => void;

function conditionChecker(context: Rule.RuleContext, max: number): ConditionCheck {
  return (test, kind) => {
    if (!test) return;
    const shape = shapeOf(test);
    if (shape.operators.size > 1) {
      context.report({ node: test as never, messageId: "mixed", data: { kind } });
    } else if (shape.operands > max) {
      context.report({ node: test as never, messageId: "tooManyOperands", data: { kind, count: String(shape.operands), operator: [...shape.operators][0], max: String(max) } });
    }
  };
}

/**
 * The `&&` and `||` operators the condition `expression` joins and how many operands they join. A `!` in front of a group
 * is looked through, so `!(a && b) || c` mixes both. `??`, calls and every other expression are one operand.
 */
function shapeOf(expression: Expression): Shape {
  const group = andOrGroup(expression);
  if (!group) return { operators: new Set(), operands: 1 };
  const left = shapeOf(group.left);
  const right = shapeOf(group.right);
  return { operators: new Set([group.operator, ...left.operators, ...right.operators]), operands: left.operands + right.operands };
}

/** The `&&` or `||` group `expression` is, looking through a `!` in front of it. */
function andOrGroup(expression: Expression): AndOr | null {
  const inner = expression.type === "UnaryExpression" && expression.operator === "!" ? expression.argument : expression;
  return isAndOr(inner) ? inner : null;
}

function isAndOr(expression: Expression): expression is AndOr {
  return expression.type === "LogicalExpression" && expression.operator !== "??";
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
    const check = conditionChecker(context, max);
    return {
      IfStatement: (node) => check(asTs<TSESTree.IfStatement>(node).test, "if"),
      WhileStatement: (node) => check(asTs<TSESTree.WhileStatement>(node).test, "while"),
      DoWhileStatement: (node) => check(asTs<TSESTree.DoWhileStatement>(node).test, "do…while"),
      ConditionalExpression: (node) => check(asTs<TSESTree.ConditionalExpression>(node).test, "ternary"),
    };
  },
});
