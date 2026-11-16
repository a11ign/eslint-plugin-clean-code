/**
 * Helpers for the function rules (FH-01, FH-07, FN-05, ONE-02, ONE-04): what kind of function a node is, who can call
 * it, and what its body uses. Everything here reads the syntax tree and scope analysis only, so it works the same under
 * ESLint and Oxlint.
 */
import type { Rule, Scope, SourceCode } from "eslint";
import { asTs, hasUseStrictDirective, isFunction, type FunctionNode, type Node, type TSESTree } from "./ast.ts";

/** What a function's own body does with `arguments` and `this`. Arrow functions share their enclosing function's. */
export interface FunctionUsage {
  usesArguments: boolean;
  usesThis: boolean;
  /** A `return this` (or an arrow whose body is `this`) belongs to this function. */
  returnsThis: boolean;
}

const FUNCTION_TYPES = ["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"] as const;

/**
 * Listeners that record, for every function, whether its body uses `arguments` or `this` and whether it returns `this`.
 * `onExit` is called when a function is left, when its usage is complete.
 */
export function trackFunctionUsage(onExit: (fn: FunctionNode, usage: FunctionUsage) => void): Rule.RuleListener {
  const stack: TrackedFunction[] = [];
  return { ...usageListeners(stack), ...functionListeners(stack, onExit) };
}

/** A function being walked, with what its body has used so far. */
interface TrackedFunction {
  fn: FunctionNode;
  usage: FunctionUsage;
}

/** Listeners that record a use of `this`, `arguments` or `return this` on the function in `stack` it belongs to. */
function usageListeners(stack: TrackedFunction[]): Rule.RuleListener {
  return {
    ThisExpression: () => markOwnerUsage(stack, "usesThis"),
    Identifier(node) {
      if (isArgumentsReference(asTs<TSESTree.Identifier>(node))) markOwnerUsage(stack, "usesArguments");
    },
    ReturnStatement(node) {
      const top = stack.at(-1);
      if (top && isThis(asTs<TSESTree.ReturnStatement>(node).argument)) top.usage.returnsThis = true;
    },
  };
}

/**
 * Marks `usage` on the function whose `this` and `arguments` a node inside `stack`'s top sees: the nearest one that is not
 * an arrow.
 */
function markOwnerUsage(stack: TrackedFunction[], usage: "usesThis" | "usesArguments"): void {
  const owner = [...stack].reverse().find((entry) => entry.fn.type !== "ArrowFunctionExpression");
  if (owner) owner.usage[usage] = true;
}

/** Whether `identifier` reads the `arguments` binding. */
function isArgumentsReference(identifier: TSESTree.Identifier): boolean {
  return identifier.name === "arguments" && isValueReference(identifier);
}

/** Listeners that push every function onto `stack` when it is entered, and pop it and call `onExit` when it is left. */
function functionListeners(stack: TrackedFunction[], onExit: (fn: FunctionNode, usage: FunctionUsage) => void): Rule.RuleListener {
  const listeners: Rule.RuleListener = {};
  const exit = () => {
    const entry = stack.pop();
    if (entry) onExit(entry.fn, entry.usage);
  };
  for (const type of FUNCTION_TYPES) {
    listeners[type] = (node: unknown) => stack.push(trackedFunction(asTs<FunctionNode>(node)));
    listeners[`${type}:exit`] = exit;
  }
  return listeners;
}

/** The function `fn` as it is entered: nothing used yet, except an arrow whose body is `this`, which returns `this`. */
function trackedFunction(fn: FunctionNode): TrackedFunction {
  const returnsThis = fn.type === "ArrowFunctionExpression" && isThis(fn.body);
  return { fn, usage: { usesArguments: false, usesThis: false, returnsThis } };
}

const TYPE_WRAPPERS = new Set(["TSAsExpression", "TSSatisfiesExpression", "TSNonNullExpression", "TSTypeAssertion", "ParenthesizedExpression"]);

/**
 * Whether `expression` gives `this`: `this`, or `this` behind a type-only wrapper (`this as this`, `this satisfies X`,
 * `this!`, `<this>this`, parentheses), or as the last expression of a sequence.
 */
export function isThis(expression: Node | null | undefined): boolean {
  let current = expression;
  while (current && givesInnerValue(current)) current = innerValue(current);
  return current?.type === "ThisExpression";
}

/** Whether the value of `expression` is the value of an expression inside it: a type-only wrapper, or a sequence. */
function givesInnerValue(expression: Node): boolean {
  return TYPE_WRAPPERS.has(expression.type) || expression.type === "SequenceExpression";
}

/** The expression whose value `expression`, a wrapper or a sequence, gives: the wrapped one, or a sequence's last. */
function innerValue(expression: Node): Node | undefined {
  return expression.type === "SequenceExpression" ? expression.expressions.at(-1) : (expression as { expression: Node }).expression;
}

/** Whether `call` is a direct `eval(…)`, which can read the local scope and `arguments`, and call anything in scope by name. */
export function isDirectEval(call: TSESTree.CallExpression): boolean {
  return call.callee.type === "Identifier" && call.callee.name === "eval" && !call.optional;
}

/**
 * Whether `variable` has more than one declaration, not counting TypeScript overload signatures: a second function of the
 * same name, or a merged namespace. A call may then reach another declaration than the one a fix rewrites.
 */
export function hasOtherDeclarations(variable: Scope.Variable): boolean {
  return variable.defs.filter((definition) => (definition.node as Node).type !== "TSDeclareFunction").length > 1;
}

/** Whether `identifier` reads a binding, rather than naming a property or a key. */
function isValueReference(identifier: TSESTree.Identifier): boolean {
  const parent = identifier.parent;
  if (parent?.type === "MemberExpression" && parent.property === identifier && !parent.computed) return false;
  if (isPlainKeyOf(parent, identifier)) return parent.type === "Property" && parent.shorthand;
  return true;
}

/** Whether `identifier` is the non-computed key of `parent`, an object property, a method or a class field. */
function isPlainKeyOf(parent: Node | undefined, identifier: TSESTree.Identifier): parent is TSESTree.Property | TSESTree.MethodDefinition | TSESTree.PropertyDefinition {
  if (parent?.type !== "Property" && parent?.type !== "MethodDefinition" && parent?.type !== "PropertyDefinition") return false;
  return parent.key === identifier && !parent.computed;
}

/** The class member or object property `fn` is the value of, if any. */
export function methodOf(fn: FunctionNode): TSESTree.MethodDefinition | TSESTree.TSAbstractMethodDefinition | TSESTree.Property | TSESTree.PropertyDefinition | null {
  const parent = fn.parent;
  if (parent?.type === "MethodDefinition" || parent?.type === "TSAbstractMethodDefinition") return parent;
  if (isPropertyValueOf(parent, fn)) return parent;
  return null;
}

/** Whether `fn` is the value of `parent`, an object property or a class field. */
function isPropertyValueOf(parent: Node | undefined, fn: FunctionNode): parent is TSESTree.Property | TSESTree.PropertyDefinition {
  if (parent?.type !== "Property" && parent?.type !== "PropertyDefinition") return false;
  return parent.value === fn;
}

/** The class `member` belongs to, if it is a class member. */
export function classOf(member: Node): TSESTree.ClassDeclaration | TSESTree.ClassExpression | null {
  const body = member.parent;
  if (body?.type !== "ClassBody") return null;
  return body.parent as TSESTree.ClassDeclaration | TSESTree.ClassExpression;
}

/**
 * Whether `fn` is exported, where it is declared or later by name (`export { f }`, `export default f`), looking up its
 * references through `sourceCode`.
 */
export function isExported(sourceCode: SourceCode, fn: FunctionNode): boolean {
  if (isExportedDeclaration(fn)) return true;
  const variable = nameVariable(sourceCode, fn);
  return (variable?.references ?? []).some((reference) => {
    const parent = (reference.identifier as Node).parent;
    return parent?.type === "ExportSpecifier" || parent?.type === "ExportDefaultDeclaration";
  });
}

/** Whether `fn` is exported where it is declared (`export function f`, `export const f`, `export default function`). */
export function isExportedDeclaration(fn: FunctionNode): boolean {
  const parent = declaringStatement(fn)?.parent;
  return parent?.type === "ExportNamedDeclaration" || parent?.type === "ExportDefaultDeclaration";
}

/** The statement that declares `fn`, a named function: the declaration itself, or the `const` declaration holding it. */
function declaringStatement(fn: FunctionNode): Node | null {
  if (fn.type === "FunctionDeclaration") return fn;
  return constDeclaratorOf(fn)?.parent ?? null;
}

/** The `const` declarator `fn` is the whole initializer of: `const f = () => …`. */
export function constDeclaratorOf(fn: FunctionNode): TSESTree.VariableDeclarator | null {
  const declarator = fn.parent;
  if (declarator?.type !== "VariableDeclarator" || declarator.init !== fn || declarator.id.type !== "Identifier") return null;
  const declaration = declarator.parent;
  return declaration?.type === "VariableDeclaration" && declaration.kind === "const" ? declarator : null;
}

/** The variable `fn` is called by, found through `sourceCode`: a function declaration's name, or the `const` it is assigned to. */
export function nameVariable(sourceCode: SourceCode, fn: FunctionNode): Scope.Variable | null {
  const declarator = constDeclaratorOf(fn);
  const declared = fn.type === "FunctionDeclaration" && fn.id ? sourceCode.getDeclaredVariables(fn as never) : declarator ? sourceCode.getDeclaredVariables(declarator as never) : [];
  const name = fn.type === "FunctionDeclaration" ? fn.id?.name : (declarator?.id as TSESTree.Identifier | undefined)?.name;
  return declared.find((variable) => variable.name === name) ?? null;
}

/**
 * The variable the own name of `fn`, a named function expression, binds inside it (`function g() {}` in
 * `const f = function g() {}`), found through `sourceCode`.
 */
export function ownNameVariable(sourceCode: SourceCode, fn: FunctionNode): Scope.Variable | null {
  if (fn.type !== "FunctionExpression" || !fn.id) return null;
  const name = fn.id.name;
  return sourceCode.getDeclaredVariables(fn as never).find((variable) => variable.name === name) ?? null;
}

/** The TypeScript overload signatures (`function f(a: string): void;`) declared next to `fn`, a function declaration. */
export function overloadSignatures(fn: FunctionNode): TSESTree.TSDeclareFunction[] {
  if (fn.type !== "FunctionDeclaration" || !fn.id) return [];
  const name = fn.id.name;
  const statement: Node = fn.parent?.type === "ExportNamedDeclaration" || fn.parent?.type === "ExportDefaultDeclaration" ? fn.parent : fn;
  const container = statement.parent;
  const siblings: Node[] = container?.type === "Program" || container?.type === "BlockStatement" || container?.type === "TSModuleBlock" ? container.body : [];
  return siblings
    .map((sibling) => (sibling.type === "ExportNamedDeclaration" || sibling.type === "ExportDefaultDeclaration" ? sibling.declaration : sibling))
    .filter((sibling): sibling is TSESTree.TSDeclareFunction => sibling?.type === "TSDeclareFunction" && sibling.id?.name === name);
}

/** The call `identifier`, a reference, is the callee of (`f(…)` or `f?.(…)`), or `null` when it is used any other way. */
export function directCall(identifier: Node): TSESTree.CallExpression | null {
  const parent = identifier.parent;
  return parent?.type === "CallExpression" && parent.callee === identifier ? parent : null;
}

/** Whether `call` passes a spread argument, which hides how many arguments it passes and where each one lands. */
export function hasSpread(call: TSESTree.CallExpression): boolean {
  return call.arguments.some((argument) => argument.type === "SpreadElement");
}

/** The variable `name` refers to when written at `node`, found by walking out through the scopes of `sourceCode`. */
export function resolveAt(sourceCode: SourceCode, node: Node, name: string): Scope.Variable | null {
  for (let scope: Scope.Scope | null = sourceCode.getScope(node as never); scope; scope = scope.upper) {
    const variable = scope.set.get(name);
    if (variable) return variable;
  }
  return null;
}

/** Whether the body of `fn` starts with a `"use strict"` directive, which a non-simple parameter list makes a syntax error. */
export function hasUseStrict(fn: FunctionNode): boolean {
  return fn.body.type === "BlockStatement" && hasUseStrictDirective(fn.body.body);
}

export { isFunction, type FunctionNode };
