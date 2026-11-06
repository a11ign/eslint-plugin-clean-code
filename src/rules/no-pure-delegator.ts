import type { Rule, Scope, SourceCode } from "eslint";
import { defineRule } from "../lib/define-rule.ts";
import { asTs, isModule, type Comment, type Node, type TSESTree } from "../lib/ast.ts";
import { isDirectiveComment, isDocComment, removeRange } from "../lib/safe-fix.ts";
import { directCall, hasSpread, isExported, nameVariable, overloadSignatures, resolveAt } from "../lib/functions.ts";

type Parameter = TSESTree.Parameter;

/** The call a delegator's body consists of, `return g(…)` or `g(…);`, and whether it returns the result. */
function delegatedCall(fn: TSESTree.FunctionDeclaration): { call: TSESTree.CallExpression; returns: boolean } | null {
  if (fn.body.body.length !== 1) return null;
  const statement = fn.body.body[0];
  if (statement.type === "ReturnStatement" && statement.argument?.type === "CallExpression") return { call: statement.argument, returns: true };
  if (statement.type === "ExpressionStatement" && statement.expression.type === "CallExpression") return { call: statement.expression, returns: false };
  return null;
}

/** The name a parameter binds when it is a single name: `a`, `a: T`, `a = 1` or `...a`. */
function parameterName(parameter: Parameter): string | null {
  if (parameter.type === "Identifier") return parameter.name;
  if (parameter.type === "AssignmentPattern" && parameter.left.type === "Identifier") return parameter.left.name;
  if (parameter.type === "RestElement" && parameter.argument.type === "Identifier") return parameter.argument.name;
  return null;
}

/** Whether the call passes the function's own parameters, unchanged and in order, and nothing else. */
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

/** The function declaration a variable names, when it is a function declared in this file. */
function declaredFunction(variable: Scope.Variable | null): Node | null {
  const definition = variable?.defs[0];
  if (!definition || variable!.defs.length !== 1) return null;
  if (definition.type === "FunctionName") return definition.node as Node;
  if (definition.type === "Variable") {
    const declarator = definition.node as TSESTree.VariableDeclarator;
    const init = declarator.init;
    if (declarator.parent?.kind === "const" && (init?.type === "FunctionExpression" || init?.type === "ArrowFunctionExpression")) return declarator;
  }
  return null;
}

/** The doc comment directly above a function, which goes with it; `null` when there is none. */
function docCommentOf(sourceCode: SourceCode, fn: Node): Comment | null {
  const before = sourceCode.getCommentsBefore(fn as never) as Comment[];
  const last = before.at(-1);
  if (!last || !isDocComment(last) || isDirectiveComment(last)) return null;
  return sourceCode.text.slice(last.range![1], fn.range[0]).trim() === "" ? last : null;
}

/** Whether any comment inside or directly above the delegator is a directive, which no fix may remove or move. */
function touchesDirective(sourceCode: SourceCode, fn: TSESTree.FunctionDeclaration): boolean {
  const inside = sourceCode.getAllComments().filter((comment) => comment.range![0] >= fn.range[0] && comment.range![1] <= fn.range[1]) as Comment[];
  const above = (sourceCode.getCommentsBefore(fn as never) as Comment[]).at(-1);
  return [...inside, ...(above ? [above] : [])].some(isDirectiveComment);
}

interface Delegation {
  fn: TSESTree.FunctionDeclaration;
  call: TSESTree.CallExpression;
  returns: boolean;
  target: Scope.Variable;
}

/** Whether the delegator itself can go: a plain function with plain parameters, not overloaded, not a script global. */
function canRemoveDelegator(sourceCode: SourceCode, { fn, call }: Delegation): boolean {
  if (fn.async || fn.generator || fn.typeParameters || call.typeArguments) return false;
  const plain = fn.params.every((parameter) => parameter.type === "Identifier" && parameter.name !== "this" && parameter.name !== "arguments");
  if (!plain || overloadSignatures(fn).length > 0) return false;
  if (!isModule(sourceCode) && fn.parent?.type === "Program") return false;
  return !touchesDirective(sourceCode, fn);
}

/** Whether the target is a hoisted function declaration that is never reassigned, so calling it directly reads the same function. */
function isStableTarget(target: Scope.Variable): boolean {
  return target.defs[0].type === "FunctionName" && !target.references.some((reference) => reference.isWrite());
}

/** Whether a reference to the delegator can call the target instead and do the same thing. */
function canRedirect(sourceCode: SourceCode, { fn, returns, target }: Delegation, reference: Scope.Reference): boolean {
  const site = directCall(reference.identifier as Node);
  if (!site || hasSpread(site) || site.arguments.length !== fn.params.length || site.typeArguments) return false;
  if (resolveAt(sourceCode, site, target.name) !== target) return false;
  const statement = site.parent?.type === "ChainExpression" ? site.parent.parent : site.parent;
  return returns || statement?.type === "ExpressionStatement";
}

/** Whether every condition of the catalog's fix holds (ONE-02). */
function canFix(sourceCode: SourceCode, delegation: Delegation, self: Scope.Variable): boolean {
  if (!canRemoveDelegator(sourceCode, delegation) || !isStableTarget(delegation.target)) return false;
  return self.references.every((reference) => canRedirect(sourceCode, delegation, reference));
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
    const sourceCode = context.sourceCode;
    return {
      FunctionDeclaration(node) {
        const fn = asTs<TSESTree.FunctionDeclaration>(node);
        if (!fn.id || isExported(sourceCode, fn)) return;
        const delegated = delegatedCall(fn);
        if (!delegated || delegated.call.optional || delegated.call.callee.type !== "Identifier") return;
        if (!passesOwnParameters(fn.params, delegated.call)) return;
        const self = nameVariable(sourceCode, fn);
        const target = resolveAt(sourceCode, delegated.call, delegated.call.callee.name);
        if (!self || !target || target === self || !declaredFunction(target)) return;
        const fix = fixFor(sourceCode, { fn, ...delegated, target }, self);
        context.report({
          node: fn.id as never,
          messageId: "pureDelegator",
          data: { name: fn.id.name, target: target.name },
          ...(fix ? { fix } : {}),
        });
      },
    };
  },
});
