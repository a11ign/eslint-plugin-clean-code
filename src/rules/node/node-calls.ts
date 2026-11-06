/**
 * What the `node` rules read in a call: which method a call makes on which object, and which function an argument passes,
 * whether written in place or named. They read only the syntax tree and its scopes, so they work the same under ESLint and Oxlint.
 */
import type { SourceCode } from "eslint";
import { isFunction, type FunctionNode, type Node, type TSESTree } from "../../lib/ast.ts";
import { resolveAt } from "../../lib/functions.ts";

/** The method name of `object.method(…)`, written without brackets, or `null` for any other callee. */
export function methodName(call: TSESTree.CallExpression): string | null {
  const { callee } = call;
  if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return null;
  return callee.property.name;
}

/** The name of the object of `object.method(…)` when it is a plain identifier, such as `process` or `http`. */
export function receiverName(call: TSESTree.CallExpression): string | null {
  const { callee } = call;
  return callee.type === "MemberExpression" && callee.object.type === "Identifier" ? callee.object.name : null;
}

/** Whether `call` is `<receiver>.<method>(…)` with one of the given receivers and methods. */
export function isMethodCall(call: TSESTree.CallExpression, receivers: ReadonlySet<string>, methods: ReadonlySet<string>): boolean {
  const receiver = receiverName(call);
  const method = methodName(call);
  return receiver !== null && method !== null && receivers.has(receiver) && methods.has(method);
}

/** Whether `node` is `<object>.<property>`, both plain names, such as `process.exitCode` or `arguments.callee`. */
export function isMemberNamed(node: Node, object: string, property: string): boolean {
  if (node.type !== "MemberExpression" || node.computed) return false;
  return node.object.type === "Identifier" && node.object.name === object && node.property.type === "Identifier" && node.property.name === property;
}

/** The function `variable` is bound to: a function declaration, a named function expression's own name, or a `const` set to a function. */
function boundFunction(definitionNode: Node): FunctionNode | null {
  if (isFunction(definitionNode)) return definitionNode;
  if (definitionNode.type !== "VariableDeclarator" || definitionNode.parent?.type !== "VariableDeclaration") return null;
  if (definitionNode.parent.kind !== "const") return null;
  return isFunction(definitionNode.init) ? definitionNode.init : null;
}

/** The function an identifier refers to where it is written, when it is bound to one by the forms `boundFunction` reads. */
export function functionNamed(sourceCode: SourceCode, identifier: TSESTree.Identifier): FunctionNode | null {
  const variable = resolveAt(sourceCode, identifier, identifier.name);
  const [definition] = variable?.defs ?? [];
  return definition ? boundFunction(definition.node as Node) : null;
}

/** The function an argument passes: one written in place, or one named by an identifier bound to it. */
export function passedFunction(sourceCode: SourceCode, argument: Node): FunctionNode | null {
  if (isFunction(argument)) return argument;
  return argument.type === "Identifier" ? functionNamed(sourceCode, argument) : null;
}

/** The functions that enclose `node`, innermost first. */
export function enclosingFunctions(node: Node): FunctionNode[] {
  const functions: FunctionNode[] = [];
  for (let current = node.parent; current; current = current.parent) {
    if (isFunction(current)) functions.push(current);
  }
  return functions;
}
