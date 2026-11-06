import type { Rule, Scope, SourceCode } from "eslint";
import { defineRule } from "../lib/define-rule.ts";
import { functionName, isModule, type FunctionNode, type Node, type TSESTree } from "../lib/ast.ts";
import {
  classOf,
  constDeclaratorOf,
  directCall,
  hasSpread,
  hasUseStrict,
  isExported,
  methodOf,
  nameVariable,
  overloadSignatures,
  ownNameVariable,
  trackFunctionUsage,
  type FunctionUsage,
} from "../lib/functions.ts";

type Parameter = TSESTree.Parameter;

/** A parameter that is a boolean flag: `flag: boolean`, `flag?: boolean`, `flag = false` or `flag: boolean = x`. */
interface Flag {
  parameter: Parameter;
  name: string;
  /** The type annotation's text, when there is one. */
  type: string | null;
  /** The default value's text, when there is one. */
  initial: string | null;
}

function isBooleanAnnotation(identifier: TSESTree.Identifier): boolean {
  return identifier.typeAnnotation?.typeAnnotation.type === "TSBooleanKeyword";
}

/** Source text of an expression that can stand alone after `=` or `:` inside an object literal or pattern. */
function standalone(sourceCode: SourceCode, expression: TSESTree.Expression): string {
  const text = sourceCode.getText(expression as never);
  return expression.type === "SequenceExpression" ? `(${text})` : text;
}

function flagOf(sourceCode: SourceCode, parameter: Parameter): Flag | null {
  const typeText = (identifier: TSESTree.Identifier) => (identifier.typeAnnotation ? sourceCode.getText(identifier.typeAnnotation.typeAnnotation as never) : null);
  if (parameter.type === "Identifier" && isBooleanAnnotation(parameter)) return { parameter, name: parameter.name, type: typeText(parameter), initial: null };
  if (parameter.type === "AssignmentPattern" && parameter.left.type === "Identifier") {
    const isBooleanDefault = parameter.right.type === "Literal" && typeof parameter.right.value === "boolean";
    if (!isBooleanDefault && !isBooleanAnnotation(parameter.left)) return null;
    return { parameter, name: parameter.left.name, type: typeText(parameter.left), initial: standalone(sourceCode, parameter.right) };
  }
  if (parameter.type === "TSParameterProperty") {
    const inner = parameter.parameter;
    const flag = inner.type === "Identifier" || inner.type === "AssignmentPattern" ? flagOf(sourceCode, inner) : null;
    return flag && { ...flag, parameter };
  }
  return null;
}

/** The key of a method, when it is a plain name. */
function methodName(member: NonNullable<ReturnType<typeof methodOf>>): string | null {
  return member.key.type === "Identifier" && !member.computed ? member.key.name : null;
}

/** Whether the function is a callback written directly as a call argument or a JSX attribute. */
function isInlineCallback(fn: FunctionNode): boolean {
  const parent = fn.parent;
  if ((parent?.type === "CallExpression" || parent?.type === "NewExpression") && parent.arguments.includes(fn as never)) return true;
  return parent?.type === "JSXExpressionContainer" && parent.parent?.type === "JSXAttribute";
}

/** Whether the function's signature is set by someone else: a callback, or a method that overrides or implements one. */
function isSignatureSetElsewhere(fn: FunctionNode, member: ReturnType<typeof methodOf>): boolean {
  if (isInlineCallback(fn)) return true;
  if (!member) return false;
  if ("override" in member && member.override) return true;
  return (classOf(member)?.implements?.length ?? 0) > 0;
}

/** The book's exception and its kin: a `setFlag(boolean)` method, a `set` accessor, and a fluent setter that returns `this`. */
function isSetter(fn: FunctionNode, member: ReturnType<typeof methodOf>, flag: Flag, usage: FunctionUsage): boolean {
  if (!member) return false;
  if ((member.type === "MethodDefinition" || member.type === "Property") && member.kind === "set") return true;
  if (/^set[A-Z]/.test(methodName(member) ?? "") && fn.params.at(-1) === flag.parameter) return true;
  return usage.returnsThis;
}

/** Whether the rule says nothing about this flag. */
function isExempt(fn: FunctionNode, flag: Flag, usage: FunctionUsage): boolean {
  const member = methodOf(fn);
  return isSignatureSetElsewhere(fn, member) || isSetter(fn, member, flag, usage);
}

/**
 * The new text of an overload signature's flag parameter, `options?: { verbose?: boolean }`, or `null` when it is not a
 * plain annotated name. A signature names the object instead of destructuring it, because an optional binding pattern
 * does not type-check there.
 */
function signatureParameter(sourceCode: SourceCode, signature: TSESTree.TSDeclareFunction, parameter: Parameter | undefined, name: string): string | null {
  if (parameter?.type !== "Identifier" || !parameter.typeAnnotation) return null;
  const optional = parameter.optional ? "?" : "";
  const taken = signature.params.some((other) => other !== parameter && other.type === "Identifier" && other.name === "options");
  return `${taken ? `${name}Options` : "options"}${optional}: { ${name}${optional}: ${sourceCode.getText(parameter.typeAnnotation.typeAnnotation as never)} }`;
}

/** `{ verbose = false }: { verbose?: boolean } = {}`: the options object that replaces the flag. */
function optionsParameter(flag: Flag): string {
  const pattern = flag.initial === null ? `{ ${flag.name} }` : `{ ${flag.name} = ${flag.initial} }`;
  return flag.type === null ? `${pattern} = {}` : `${pattern}: { ${flag.name}?: ${flag.type} } = {}`;
}

/** The fix's edit to one call: its flag argument, if it passes one, becomes `{ name: argument }`. */
function callFix(fixer: Rule.RuleFixer, call: TSESTree.CallExpression, index: number, name: string): Rule.Fix[] {
  const argument = call.arguments[index] as TSESTree.Expression | undefined;
  if (!argument) return [];
  if (argument.type === "Identifier" && argument.name === name) return [fixer.replaceText(argument as never, `{ ${name} }`)];
  const sequence = argument.type === "SequenceExpression";
  return [fixer.insertTextBefore(argument as never, `{ ${name}: ${sequence ? "(" : ""}`), fixer.insertTextAfter(argument as never, `${sequence ? ")" : ""} }`)];
}

/** Whether an identifier is the name a `const` declares, which scope analysis lists as its initialising write. */
function isDeclaringName(identifier: Node): boolean {
  return identifier.parent?.type === "VariableDeclarator" && identifier.parent.id === identifier;
}

/** Whether the function itself meets the fix's conditions: a plain, unexported function of an ES module, with the flag last. */
function canRewriteFunction(sourceCode: SourceCode, fn: FunctionNode, flag: Flag, usage: FunctionUsage): boolean {
  if (!isModule(sourceCode) || methodOf(fn) || flag.parameter.type === "TSParameterProperty") return false;
  if (fn.type !== "FunctionDeclaration" && !constDeclaratorOf(fn)) return false;
  if (isExported(sourceCode, fn) || usage.usesArguments || hasUseStrict(fn) || flag.name === "__proto__") return false;
  const isLast = fn.params.indexOf(flag.parameter) === fn.params.length - 1;
  return isLast && !fn.params.some((parameter) => parameter.type === "Identifier" && parameter.name === "this");
}

/** Every call of the function, or `null` when a reference is not a direct call without spread arguments. */
function callsOf(sourceCode: SourceCode, fn: FunctionNode): TSESTree.CallExpression[] | null {
  const variables = [nameVariable(sourceCode, fn), ownNameVariable(sourceCode, fn)].filter((variable): variable is Scope.Variable => variable !== null);
  if (variables.length === 0) return null;
  const calls: TSESTree.CallExpression[] = [];
  for (const reference of variables.flatMap((variable) => variable.references)) {
    if (isDeclaringName(reference.identifier as Node)) continue;
    const call = directCall(reference.identifier as Node);
    if (!call || hasSpread(call)) return null;
    calls.push(call);
  }
  return calls;
}

/** The options-object fix, or `null` when one of the catalog's conditions does not hold (FH-01). */
function fixFor(sourceCode: SourceCode, fn: FunctionNode, flag: Flag, usage: FunctionUsage): Rule.ReportFixer | null {
  if (!canRewriteFunction(sourceCode, fn, flag, usage)) return null;
  const calls = callsOf(sourceCode, fn);
  if (!calls) return null;
  const index = fn.params.length - 1;
  const signatures = overloadSignatures(fn)
    .filter((signature) => index < signature.params.length)
    .map((signature) => ({ parameter: signature.params[index], text: signatureParameter(sourceCode, signature, signature.params[index], flag.name) }));
  if (signatures.some((signature) => signature.text === null)) return null;
  return (fixer) => [
    fixer.replaceText(flag.parameter as never, optionsParameter(flag)),
    ...signatures.map((signature) => fixer.replaceText(signature.parameter as never, signature.text as string)),
    ...calls.flatMap((call) => callFix(fixer, call, index, flag.name)),
  ];
}

export default defineRule({
  name: "no-flag-argument",
  type: "suggestion",
  description: "Don't pass a boolean flag into a function: it says the function does more than one thing.",
  book: {
    entry: "FH-01",
    chapter: "8 Function Heuristics § Flag Arguments",
    passage: "Flag arguments are ugly. Passing a `boolean` into a function is generally careless. It immediately complicates the signature of the function, and loudly proclaims that the function does more than one thing.",
  },
  fixable: "code",
  messages: {
    flagArgument: {
      problem: "Parameter `{{name}}` of `{{function}}` is a boolean flag, so the function does one thing when it is true and another when it is false.",
      refactor:
        "split the function in two, one per value of the flag, each named for what it does (the book's `getLongMonthNames()` and `getShortMonthNames()`). Where it can see every call, the autofix instead turns the flag into a named property of an options object (`f(x, { verbose: true })`), so each call says what the flag means.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    return trackFunctionUsage((fn, usage) => {
      for (const parameter of fn.params) {
        const flag = flagOf(sourceCode, parameter);
        if (!flag || isExempt(fn, flag, usage)) continue;
        const fix = fixFor(sourceCode, fn, flag, usage);
        context.report({
          node: parameter as never,
          messageId: "flagArgument",
          data: { name: flag.name, function: functionName(fn) ?? "(anonymous)" },
          ...(fix ? { fix } : {}),
        });
      }
    });
  },
});
