import type { Rule, Scope, SourceCode } from "eslint";
import { defineRule } from "../lib/define-rule.ts";
import { asTs, isModule, type Comment, type Node, type TSESTree } from "../lib/ast.ts";
import { isDirectiveComment, isDocComment, removeRange } from "../lib/safe-fix.ts";
import { directCall, hasOtherDeclarations, hasSpread, isDirectEval, isExported, nameVariable, overloadSignatures, resolveAt } from "../lib/functions.ts";

type Parameter = TSESTree.Parameter;

/** The literals that take their type from the parameter they are passed to. */
const CONTEXTUALLY_TYPED = new Set(["ArrowFunctionExpression", "FunctionExpression", "ObjectExpression", "ArrayExpression"]);

/** A pure delegator, and the variable its name binds. */
interface FoundDelegator {
  delegation: Delegation;
  self: Scope.Variable;
}

/**
 * The pure delegators of a file. They are reported at the end, once the whole file is known: a direct `eval` anywhere can
 * call a delegator by name, so then none of them is fixed.
 */
class DelegatorScan {
  private readonly context: Rule.RuleContext;
  private readonly found: FoundDelegator[] = [];
  private hasDirectEval = false;

  constructor(context: Rule.RuleContext) {
    this.context = context;
  }

  noteCall(call: TSESTree.CallExpression): void {
    if (isDirectEval(call)) this.hasDirectEval = true;
  }

  noteFunction(fn: TSESTree.FunctionDeclaration): void {
    const delegator = findDelegator(this.context.sourceCode, fn);
    if (delegator) this.found.push(delegator);
  }

  reportAll(): void {
    for (const { delegation, self } of this.found) {
      const fix = this.hasDirectEval ? null : fixFor(this.context.sourceCode, delegation, self);
      this.context.report({
        node: delegation.fn.id as never,
        messageId: "pureDelegator",
        data: { name: self.name, target: delegation.target.name },
        ...(fix ? { fix } : {}),
      });
    }
  }
}

/**
 * `fn` as a pure delegator, its names resolved in `sourceCode`: not exported, its body one call by name that passes its own
 * parameters to another function of this file.
 */
function findDelegator(sourceCode: SourceCode, fn: TSESTree.FunctionDeclaration): FoundDelegator | null {
  if (!fn.id || isExported(sourceCode, fn)) return null;
  const delegated = delegatedCall(fn);
  if (!delegated || !callsByName(delegated.call) || !passesOwnParameters(fn.params, delegated.call)) return null;
  const self = nameVariable(sourceCode, fn);
  const target = resolveAt(sourceCode, delegated.call, delegated.call.callee.name);
  if (!self || !isOtherDeclaredFunction(target, self)) return null;
  return { delegation: { fn, ...delegated, target }, self };
}

/** Whether `call` is a plain, non-optional call of a name: `g(…)`, not `g?.(…)` or `o.g(…)`. */
function callsByName(call: TSESTree.CallExpression): call is TSESTree.CallExpression & { callee: TSESTree.Identifier } {
  return !call.optional && call.callee.type === "Identifier";
}

/** Whether `target` is a function declared in this file, other than the delegator `self`. */
function isOtherDeclaredFunction(target: Scope.Variable | null, self: Scope.Variable): target is Scope.Variable {
  return target !== null && target !== self && declaredFunction(target) !== null;
}

/** The call the body of the delegator `fn` consists of, `return g(…)` or `g(…);`, and whether it returns the result. */
function delegatedCall(fn: TSESTree.FunctionDeclaration): { call: TSESTree.CallExpression; returns: boolean } | null {
  if (fn.body.body.length !== 1) return null;
  const statement = fn.body.body[0];
  if (statement.type === "ReturnStatement" && statement.argument?.type === "CallExpression") return { call: statement.argument, returns: true };
  if (statement.type === "ExpressionStatement" && statement.expression.type === "CallExpression") return { call: statement.expression, returns: false };
  return null;
}

/** Whether `call` passes the function's own `params`, unchanged and in order, and nothing else. */
function passesOwnParameters(params: Parameter[], call: TSESTree.CallExpression): boolean {
  if (params.length !== call.arguments.length) return false;
  return params.every((parameter, index) => {
    const name = parameterName(parameter);
    const argument = call.arguments[index];
    if (!name || name === "this") return false;
    if (parameter.type === "RestElement") return argument.type === "SpreadElement" && argument.argument.type === "Identifier" && argument.argument.name === name;
    return argument.type === "Identifier" && argument.name === name;
  });
}

/** The name `parameter` binds when it is a single name: `a`, `a: T`, `a = 1` or `...a`. */
function parameterName(parameter: Parameter): string | null {
  if (parameter.type === "Identifier") return parameter.name;
  if (parameter.type === "AssignmentPattern" && parameter.left.type === "Identifier") return parameter.left.name;
  if (parameter.type === "RestElement" && parameter.argument.type === "Identifier") return parameter.argument.name;
  return null;
}

/** The function declaration `variable` names, when it is a function declared in this file. */
function declaredFunction(variable: Scope.Variable | null): Node | null {
  const definition = variable?.defs[0];
  if (!definition || variable!.defs.length !== 1) return null;
  if (definition.type === "FunctionName") return definition.node as Node;
  if (definition.type !== "Variable") return null;
  const declarator = definition.node as TSESTree.VariableDeclarator;
  return isConstFunction(declarator) ? declarator : null;
}

/** Whether `declarator` is a `const` bound to a function expression or an arrow function. */
function isConstFunction(declarator: TSESTree.VariableDeclarator): boolean {
  const init = declarator.init;
  return declarator.parent?.kind === "const" && (init?.type === "FunctionExpression" || init?.type === "ArrowFunctionExpression");
}

interface Delegation {
  fn: TSESTree.FunctionDeclaration;
  call: TSESTree.CallExpression;
  returns: boolean;
  target: Scope.Variable;
}

function fixFor(sourceCode: SourceCode, delegation: Delegation, self: Scope.Variable): Rule.ReportFixer | null {
  if (!canFix(sourceCode, delegation, self)) return null;
  const { fn, target } = delegation;
  const start = docCommentOf(sourceCode, fn)?.range![0] ?? fn.range[0];
  return (fixer) => [
    removeRange(fixer, sourceCode, [start, fn.range[1]]),
    ...self.references.map((reference) => fixer.replaceText(reference.identifier as never, target.name)),
  ];
}

/**
 * Whether every condition of the catalog's fix (ONE-02) holds for `delegation`: its delegator can go, its target is stable, and
 * every reference to `self` can call the target instead, as resolved in `sourceCode`.
 */
function canFix(sourceCode: SourceCode, delegation: Delegation, self: Scope.Variable): boolean {
  if (!canRemoveDelegator(sourceCode, delegation) || !isStableTarget(delegation.target) || hasOtherDeclarations(self)) return false;
  return self.references.every((reference) => canRedirect(sourceCode, delegation, reference));
}

/**
 * Whether the delegator `fn` itself can go: a plain function with plain parameters, not generic in itself or its `call`, not
 * overloaded, and neither a script global nor next to a directive in `sourceCode`.
 */
function canRemoveDelegator(sourceCode: SourceCode, { fn, call }: Delegation): boolean {
  if (isAsyncOrGenerator(fn) || isGeneric(fn, call)) return false;
  const plain = fn.params.every((parameter) => parameter.type === "Identifier" && parameter.name !== "this" && parameter.name !== "arguments");
  if (!plain || overloadSignatures(fn).length > 0) return false;
  if (!isModule(sourceCode) && fn.parent?.type === "Program") return false;
  return !touchesDirective(sourceCode, fn);
}

function isAsyncOrGenerator(fn: TSESTree.FunctionDeclaration): boolean {
  return fn.async || fn.generator;
}

/** Whether the delegator `fn` declares type parameters or its `call` passes type arguments, which calling the target directly would lose. */
function isGeneric(fn: TSESTree.FunctionDeclaration, call: TSESTree.CallExpression): boolean {
  return Boolean(fn.typeParameters || call.typeArguments);
}

/** Whether any comment of `sourceCode` inside or directly above the delegator `fn` is a directive, which no fix may remove or move. */
function touchesDirective(sourceCode: SourceCode, fn: TSESTree.FunctionDeclaration): boolean {
  const inside = sourceCode.getAllComments().filter((comment) => comment.range![0] >= fn.range[0] && comment.range![1] <= fn.range[1]) as Comment[];
  const above = (sourceCode.getCommentsBefore(fn as never) as Comment[]).at(-1);
  return [...inside, ...(above ? [above] : [])].some(isDirectiveComment);
}

/** Whether `target` is a hoisted function declaration that is never reassigned, so calling it directly reads the same function. */
function isStableTarget(target: Scope.Variable): boolean {
  return target.defs[0].type === "FunctionName" && !target.references.some((reference) => reference.isWrite());
}

/**
 * Whether `reference` to the delegator `fn` can call `target` instead and do the same thing: a plain call where `target`
 * resolves the same in `sourceCode`, standing as a statement of its own unless `fn` `returns` the call's result.
 */
function canRedirect(sourceCode: SourceCode, { fn, returns, target }: Delegation, reference: Scope.Reference): boolean {
  const site = directCall(reference.identifier as Node);
  if (!site || !isPlainCall(site, fn)) return false;
  const annotated = fn.params.some((parameter) => parameter.type === "Identifier" && parameter.typeAnnotation);
  if (annotated && site.arguments.some((argument) => isContextuallyTyped(argument))) return false;
  if (resolveAt(sourceCode, site, target.name) !== target) return false;
  const statement = site.parent?.type === "ChainExpression" ? site.parent.parent : site.parent;
  return returns || statement?.type === "ExpressionStatement";
}

/** Whether the call `site` passes one plain argument per parameter of the delegator `fn`, with no spread and no type arguments. */
function isPlainCall(site: TSESTree.CallExpression, fn: TSESTree.FunctionDeclaration): boolean {
  return !hasSpread(site) && site.arguments.length === fn.params.length && !site.typeArguments;
}

/**
 * Whether `argument` takes its type from the parameter it is passed to: a function, an object or an array literal, also
 * as a branch of `?:`, `&&`, `||` or `??` or the last expression of a sequence. Passed to `g` instead, it would be typed
 * by `g`'s parameter, and an arrow's `value` could become an implicit `any` (TS7006).
 */
function isContextuallyTyped(argument: Node): boolean {
  if (CONTEXTUALLY_TYPED.has(argument.type)) return true;
  return valueBranches(argument).some((branch) => isContextuallyTyped(branch));
}

/** The expressions the value of `argument` comes from: the branches of `?:`, both sides of `&&`, `||` or `??`, the last of a sequence. */
function valueBranches(argument: Node): Node[] {
  switch (argument.type) {
    case "ConditionalExpression":
      return [argument.consequent, argument.alternate];
    case "LogicalExpression":
      return [argument.left, argument.right];
    case "SequenceExpression":
      return [argument.expressions.at(-1) as Node];
    default:
      return [];
  }
}

/** The doc comment directly above `fn` in `sourceCode`, which goes with it; `null` when there is none. */
function docCommentOf(sourceCode: SourceCode, fn: Node): Comment | null {
  const before = sourceCode.getCommentsBefore(fn as never) as Comment[];
  const last = before.at(-1);
  if (!last || !isDocComment(last) || isDirectiveComment(last)) return null;
  return sourceCode.text.slice(last.range![1], fn.range[0]).trim() === "" ? last : null;
}

export default defineRule({
  name: "no-pure-delegator",
  type: "suggestion",
  description: "Don't extract the whole body of a function into another one, leaving a function that only passes its parameters on.",
  book: {
    entry: "ONE-02",
    chapter: "10 One Thing § Extract Method Refactoring",
    passage: "There is no point in extracting the entire body of a function, leaving behind a pure delegator. Such an extraction is not meaningful.",
  },
  fixable: "code",
  messages: {
    pureDelegator: {
      problem: "Function `{{name}}` only passes its parameters, unchanged, to `{{target}}`.",
      refactor: "call the function it delegates to directly and remove the delegator, or extract only part of the body so that the extraction is meaningful.",
    },
  },
  create(context) {
    const scan = new DelegatorScan(context);
    return {
      CallExpression: (node) => scan.noteCall(node as TSESTree.CallExpression),
      "Program:exit": () => scan.reportAll(),
      FunctionDeclaration: (node) => scan.noteFunction(asTs<TSESTree.FunctionDeclaration>(node)),
    };
  },
});
