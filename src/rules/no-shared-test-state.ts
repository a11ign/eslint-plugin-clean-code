import type { Rule, Scope, SourceCode } from "eslint";
import { defineRule } from "../lib/define-rule.ts";
import { asTs, isFunction, type FunctionNode, type TSESTree } from "../lib/ast.ts";
import { hookCallback, readTestCall } from "../lib/test-calls.ts";

/** Hooks that run around every test, so a variable they assign is reset for each one. */
const RESET_HOOKS = new Set(["beforeEach", "afterEach"]);

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
    const writes: Writes = { pending: [], reset: new Set() };
    return {
      "AssignmentExpression, UpdateExpression, ForInStatement, ForOfStatement"(node: unknown) {
        recordWrite(context.sourceCode, writes, asTs<Write>(node));
      },
      "Program:exit"() {
        reportSharedState(context, writes);
      },
    };
  },
});

type Write = TSESTree.AssignmentExpression | TSESTree.UpdateExpression | TSESTree.ForInStatement | TSESTree.ForOfStatement;

/** A write to a variable declared outside the test or hook that makes it. */
interface OuterWrite {
  identifier: TSESTree.Identifier;
  variable: Scope.Variable;
}

/** The outer writes tests make, reported at the end, and the variables a reset hook assigns, which are not. */
interface Writes {
  pending: OuterWrite[];
  reset: Set<Scope.Variable>;
}

function recordWrite(sourceCode: SourceCode, writes: Writes, node: Write): void {
  const owner = ownerOf(node);
  if (!owner) return;
  for (const identifier of targetIdentifiers(writeTarget(node))) {
    const variable = resolve(sourceCode.getScope(identifier as never), identifier);
    if (variable && !declaredInside(variable, owner.callback)) recordOuterWrite(writes, owner.kind, { identifier, variable });
  }
}

/** What a write assigns. A `for…in` or `for…of` that declares its binding assigns nothing declared outside it. */
function writeTarget(node: Write): TSESTree.Node | null {
  if (node.type === "AssignmentExpression") return node.left;
  if (node.type === "UpdateExpression") return node.argument;
  return node.left.type === "VariableDeclaration" ? null : node.left;
}

/** The variables a write target names: `x`, `[x, y]`, `{ a: x, ...rest }`, `x = fallback`. Member writes are not variables. */
function targetIdentifiers(target: TSESTree.Node | null): TSESTree.Identifier[] {
  if (!target) return [];
  if (target.type === "Identifier") return [target];
  return innerTargets(target).flatMap((inner) => targetIdentifiers(inner));
}

/** The write targets inside a destructuring pattern, a default value, or a TypeScript wrapper such as `x!` or `x as T`. */
function innerTargets(target: TSESTree.Node): (TSESTree.Node | null)[] {
  if (isTypeWrapper(target)) return [target.expression];
  if (target.type === "RestElement") return [target.argument];
  if (target.type === "AssignmentPattern") return [target.left];
  if (target.type === "ArrayPattern") return target.elements;
  if (target.type === "ObjectPattern") return target.properties.map((property) => (property.type === "Property" ? property.value : property));
  return [];
}

const TYPE_WRAPPERS: ReadonlySet<string> = new Set(["TSNonNullExpression", "TSAsExpression", "TSSatisfiesExpression", "TSTypeAssertion"]);

function isTypeWrapper(node: TSESTree.Node): node is TSESTree.TSNonNullExpression | TSESTree.TSAsExpression | TSESTree.TSSatisfiesExpression | TSESTree.TSTypeAssertion {
  return TYPE_WRAPPERS.has(node.type);
}

/** The variable `identifier` refers to, found by name from the innermost scope outwards. */
function resolve(scope: Scope.Scope, identifier: TSESTree.Identifier): Scope.Variable | null {
  for (let current: Scope.Scope | null = scope; current; current = current.upper) {
    const variable = current.set.get(identifier.name);
    if (variable) return variable;
  }
  return null;
}

/** A test or reset hook, and its callback. */
interface Owner {
  kind: "test" | "hook";
  callback: FunctionNode;
}

/** The nearest test (`it`, `test`) or `beforeEach`/`afterEach` callback around `node`, whichever is innermost. */
function ownerOf(node: TSESTree.Node): Owner | null {
  for (let current = node.parent; current; current = current.parent) {
    const owner = ownerWithCallback(current);
    if (owner) return owner;
  }
  return null;
}

/** The test or reset hook whose callback is `node`, or `null` when `node` is not one. */
function ownerWithCallback(node: TSESTree.Node): Owner | null {
  if (!isFunction(node) || node.parent?.type !== "CallExpression") return null;
  const call = node.parent;
  if (hookCallback(call, RESET_HOOKS) === node) return { kind: "hook", callback: node };
  const test = readTestCall(call);
  return test && test.kind !== "describe" && test.callback === node ? { kind: "test", callback: node } : null;
}

function declaredInside(variable: Scope.Variable, callback: FunctionNode): boolean {
  return variable.identifiers.some((identifier) => contains(callback, asTs<TSESTree.Identifier>(identifier)));
}

function contains(outer: { range: [number, number] }, inner: { range?: [number, number] }): boolean {
  return inner.range !== undefined && outer.range[0] <= inner.range[0] && inner.range[1] <= outer.range[1];
}

function recordOuterWrite(writes: Writes, kind: Owner["kind"], write: OuterWrite): void {
  if (kind === "hook") writes.reset.add(write.variable);
  else writes.pending.push(write);
}

function reportSharedState(context: Rule.RuleContext, writes: Writes): void {
  for (const { identifier, variable } of writes.pending) {
    if (!writes.reset.has(variable)) context.report({ node: identifier as never, messageId: "sharedState", data: { name: identifier.name } });
  }
}
