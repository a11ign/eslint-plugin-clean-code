import type { Scope } from "eslint";
import { defineRule } from "../lib/define-rule.ts";
import { asTs, isFunction, type FunctionNode, type TSESTree } from "../lib/ast.ts";
import { hookCallback, readTestCall } from "../lib/test-calls.ts";

/** Hooks that run around every test, so a variable they assign is reset for each one. */
const RESET_HOOKS = new Set(["beforeEach", "afterEach"]);

/** The variables a write target names: `x`, `[x, y]`, `{ a: x, ...rest }`, `x = fallback`. Member writes are not variables. */
function targetIdentifiers(target: TSESTree.Node | null): TSESTree.Identifier[] {
  if (!target) return [];
  switch (target.type) {
    case "Identifier":
      return [target];
    case "ArrayPattern":
      return target.elements.flatMap((element) => targetIdentifiers(element));
    case "ObjectPattern":
      return target.properties.flatMap((property) => targetIdentifiers(property.type === "Property" ? property.value : property));
    case "RestElement":
      return targetIdentifiers(target.argument);
    case "AssignmentPattern":
      return targetIdentifiers(target.left);
    case "TSNonNullExpression":
    case "TSAsExpression":
    case "TSSatisfiesExpression":
    case "TSTypeAssertion":
      return targetIdentifiers(target.expression);
    default:
      return [];
  }
}

/** The variable `identifier` refers to, found by name from the innermost scope outwards. */
function resolve(scope: Scope.Scope, identifier: TSESTree.Identifier): Scope.Variable | null {
  for (let current: Scope.Scope | null = scope; current; current = current.upper) {
    const variable = current.set.get(identifier.name);
    if (variable) return variable;
  }
  return null;
}

function contains(outer: { range: [number, number] }, inner: { range?: [number, number] }): boolean {
  return inner.range !== undefined && outer.range[0] <= inner.range[0] && inner.range[1] <= outer.range[1];
}

/** The nearest test (`it`, `test`) or `beforeEach`/`afterEach` callback around `node`, whichever is innermost. */
function ownerOf(node: TSESTree.Node): { kind: "test" | "hook"; callback: FunctionNode } | null {
  for (let current = node.parent; current; current = current.parent) {
    if (!isFunction(current) || current.parent?.type !== "CallExpression") continue;
    const call = current.parent;
    if (hookCallback(call, RESET_HOOKS) === current) return { kind: "hook", callback: current };
    const test = readTestCall(call);
    if (test && test.kind !== "describe" && test.callback === current) return { kind: "test", callback: current };
  }
  return null;
}

function declaredInside(variable: Scope.Variable, callback: FunctionNode): boolean {
  return variable.identifiers.some((identifier) => contains(callback, asTs<TSESTree.Identifier>(identifier)));
}

export default defineRule({
  name: "no-shared-test-state",
  type: "problem",
  description: "A test does not assign variables declared outside it, so no test sets up the conditions for the next.",
  book: {
    entry: "TST-04",
    chapter: "15 Clean Tests § Isolated",
    passage: "Tests should not depend on each other. One test should not set up the conditions for the next test. You should be able to run each test independently and run the tests in any order you like.",
  },
  messages: {
    sharedState: {
      problem: "This test assigns `{{name}}`, which is declared outside the test and not reset in a `beforeEach` or `afterEach` hook, so the next test starts with whatever this one left in it.",
      refactor: "declare `{{name}}` inside the test, or set it in a `beforeEach` hook so every test starts from the same value.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const pending: Array<{ identifier: TSESTree.Identifier; variable: Scope.Variable }> = [];
    const reset = new Set<Scope.Variable>();

    function check(node: TSESTree.Node, target: TSESTree.Node | null): void {
      const owner = ownerOf(node);
      if (!owner) return;
      for (const identifier of targetIdentifiers(target)) {
        const variable = resolve(sourceCode.getScope(identifier as never), identifier);
        if (!variable || declaredInside(variable, owner.callback)) continue;
        if (owner.kind === "hook") reset.add(variable);
        else pending.push({ identifier, variable });
      }
    }

    return {
      AssignmentExpression(node) {
        const assignment = asTs<TSESTree.AssignmentExpression>(node);
        check(assignment, assignment.left);
      },
      UpdateExpression(node) {
        const update = asTs<TSESTree.UpdateExpression>(node);
        check(update, update.argument);
      },
      "ForInStatement, ForOfStatement"(node: unknown) {
        const loop = asTs<TSESTree.ForInStatement | TSESTree.ForOfStatement>(node);
        if (loop.left.type !== "VariableDeclaration") check(loop, loop.left);
      },
      "Program:exit"() {
        for (const { identifier, variable } of pending) {
          if (reset.has(variable)) continue;
          context.report({ node: identifier as never, messageId: "sharedState", data: { name: identifier.name } });
        }
      },
    };
  },
});
