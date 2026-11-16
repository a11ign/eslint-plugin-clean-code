import type { Rule, Scope, SourceCode } from "eslint";
import { defineRule } from "../lib/define-rule.ts";
import { functionName, isModule, type FunctionNode, type Node, type TSESTree } from "../lib/ast.ts";
import {
  classOf,
  constDeclaratorOf,
  directCall,
  hasOtherDeclarations,
  hasSpread,
  hasUseStrict,
  isDirectEval,
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
  /** `flag: boolean`: annotated, not optional and with no default, so every caller must pass it. */
  required: boolean;
}

/** A flag parameter of a function, with what the function does with `this` and `arguments`. */
interface FlaggedParameter {
  fn: FunctionNode;
  flag: Flag;
  usage: FunctionUsage;
}

type Method = NonNullable<ReturnType<typeof methodOf>>;

/** The flags of `fn` the rule reports. */
function flaggedParameters(sourceCode: SourceCode, fn: FunctionNode, usage: FunctionUsage): FlaggedParameter[] {
  return fn.params
    .map((parameter) => flagOf(sourceCode, parameter))
    .filter((flag): flag is Flag => flag !== null)
    .map((flag) => ({ fn, flag, usage }))
    .filter((found) => !isExempt(found));
}

function flagOf(sourceCode: SourceCode, parameter: Parameter): Flag | null {
  if (parameter.type === "Identifier") return isBooleanAnnotation(parameter) ? annotatedFlag(sourceCode, parameter) : null;
  if (parameter.type === "AssignmentPattern") return defaultedFlag(sourceCode, parameter);
  if (parameter.type === "TSParameterProperty") return propertyFlag(sourceCode, parameter);
  return null;
}

function isBooleanAnnotation(identifier: TSESTree.Identifier): boolean {
  return identifier.typeAnnotation?.typeAnnotation.type === "TSBooleanKeyword";
}

/** `flag: boolean` or `flag?: boolean`. */
function annotatedFlag(sourceCode: SourceCode, parameter: TSESTree.Identifier): Flag {
  return { parameter, name: parameter.name, type: typeText(sourceCode, parameter), initial: null, required: !parameter.optional };
}

/** `flag = false` or `flag: boolean = x`. */
function defaultedFlag(sourceCode: SourceCode, parameter: TSESTree.AssignmentPattern): Flag | null {
  const left = parameter.left;
  if (left.type !== "Identifier") return null;
  const isFlag = isBooleanLiteral(parameter.right) || isBooleanAnnotation(left);
  return isFlag ? { parameter, name: left.name, type: typeText(sourceCode, left), initial: standalone(sourceCode, parameter.right), required: false } : null;
}

/** A flag declared as a constructor parameter property (`private flag: boolean`). */
function propertyFlag(sourceCode: SourceCode, parameter: TSESTree.TSParameterProperty): Flag | null {
  const flag = flagOf(sourceCode, parameter.parameter);
  return flag && { ...flag, parameter };
}

function typeText(sourceCode: SourceCode, identifier: TSESTree.Identifier): string | null {
  return identifier.typeAnnotation ? sourceCode.getText(identifier.typeAnnotation.typeAnnotation as never) : null;
}

function isBooleanLiteral(expression: TSESTree.Expression): boolean {
  return expression.type === "Literal" && typeof expression.value === "boolean";
}

/** Source text of an expression that can stand alone after `=` or `:` inside an object literal or pattern. */
function standalone(sourceCode: SourceCode, expression: TSESTree.Expression): string {
  const text = sourceCode.getText(expression as never);
  return expression.type === "SequenceExpression" ? `(${text})` : text;
}

/** Whether the rule says nothing about this flag. */
function isExempt(found: FlaggedParameter): boolean {
  const member = methodOf(found.fn);
  return isSignatureSetElsewhere(found.fn, member) || isSetter(found, member);
}

/** Whether the function's signature is set by someone else: a callback, or a method that overrides or implements one. */
function isSignatureSetElsewhere(fn: FunctionNode, member: Method | null): boolean {
  if (isInlineCallback(fn)) return true;
  if (!member) return false;
  if ("override" in member && member.override) return true;
  return (classOf(member)?.implements?.length ?? 0) > 0;
}

/** Whether the function is a callback written directly as a call argument or a JSX attribute. */
function isInlineCallback(fn: FunctionNode): boolean {
  const parent = fn.parent;
  if (isCallArgument(fn)) return true;
  return parent?.type === "JSXExpressionContainer" && parent.parent?.type === "JSXAttribute";
}

function isCallArgument(fn: FunctionNode): boolean {
  const parent = fn.parent;
  const isCall = parent?.type === "CallExpression" || parent?.type === "NewExpression";
  return isCall && parent.arguments.includes(fn as never);
}

/** The book's exception and its kin: a `setFlag(boolean)` method, a `set` accessor, and a fluent setter that returns `this`. */
function isSetter({ fn, flag, usage }: FlaggedParameter, member: Method | null): boolean {
  if (!member) return false;
  if (isSetAccessor(member)) return true;
  if (/^set[A-Z]/.test(methodName(member) ?? "") && fn.params.at(-1) === flag.parameter) return true;
  return usage.returnsThis;
}

function isSetAccessor(member: Method): boolean {
  const hasKind = member.type === "MethodDefinition" || member.type === "Property";
  return hasKind && member.kind === "set";
}

/** The key of a method, when it is a plain name. */
function methodName(member: Method): string | null {
  return member.key.type === "Identifier" && !member.computed ? member.key.name : null;
}

function reportFlag(context: Rule.RuleContext, { fn, flag }: FlaggedParameter, fix: Rule.ReportFixer | null): void {
  context.report({
    node: flag.parameter as never,
    messageId: "flagArgument",
    data: { name: flag.name, function: functionName(fn) ?? "(anonymous)" },
    ...(fix ? { fix } : {}),
  });
}

/** The options-object fix, or `null` when one of the catalog's conditions does not hold (FH-01). */
function fixFor(sourceCode: SourceCode, found: FlaggedParameter): Rule.ReportFixer | null {
  const calls = canRewriteFunction(sourceCode, found) ? callsOf(sourceCode, found.fn) : null;
  const index = found.fn.params.length - 1;
  if (!calls || leavesOutRequiredFlag(found.flag, calls, index)) return null;
  const signatures = signatureEdits(sourceCode, found.fn, found.flag.name);
  if (!signatures) return null;
  return (fixer) => [
    fixer.replaceText(found.flag.parameter as never, optionsParameter(found.flag)),
    ...signatures.map((signature) => fixer.replaceText(signature.parameter as never, signature.text as string)),
    ...calls.flatMap((call) => argumentFix(fixer, call.arguments[index] as TSESTree.Expression | undefined, found.flag.name)),
  ];
}

/** Whether the function itself meets the fix's conditions: a plain, unexported function of an ES module, with the flag last. */
function canRewriteFunction(sourceCode: SourceCode, { fn, flag, usage }: FlaggedParameter): boolean {
  if (!isModule(sourceCode) || methodOf(fn) || flag.parameter.type === "TSParameterProperty") return false;
  if (fn.type !== "FunctionDeclaration" && !constDeclaratorOf(fn)) return false;
  if (isExported(sourceCode, fn) || usage.usesArguments || hasUseStrict(fn)) return false;
  if (flag.name === "__proto__") return false;
  const isLast = fn.params.indexOf(flag.parameter) === fn.params.length - 1;
  return isLast && !fn.params.some((parameter) => parameter.type === "Identifier" && parameter.name === "this");
}

/** Every call of the function, or `null` when a reference is not a direct call without spread arguments. */
function callsOf(sourceCode: SourceCode, fn: FunctionNode): TSESTree.CallExpression[] | null {
  const variables = [nameVariable(sourceCode, fn), ownNameVariable(sourceCode, fn)].filter((variable): variable is Scope.Variable => variable !== null);
  if (variables.length === 0 || variables.some(hasOtherDeclarations)) return null;
  const references = variables.flatMap((variable) => variable.references).map((reference) => reference.identifier as Node);
  const calls = references.filter((identifier) => !isDeclaringName(identifier)).map((identifier) => directCall(identifier));
  return calls.every(isPlainCall) ? calls : null;
}

/** Whether an identifier is the name a `const` declares, which scope analysis lists as its initialising write. */
function isDeclaringName(identifier: Node): boolean {
  return identifier.parent?.type === "VariableDeclarator" && identifier.parent.id === identifier;
}

/** A call the fix can edit: one that exists and passes no spread arguments. */
function isPlainCall(call: TSESTree.CallExpression | null): call is TSESTree.CallExpression {
  return call !== null && !hasSpread(call);
}

/** A required flag gets no `= {}`, so a call that leaves it out would throw on destructuring `undefined`. */
function leavesOutRequiredFlag(flag: Flag, calls: TSESTree.CallExpression[], index: number): boolean {
  return flag.required && calls.some((call) => call.arguments.length <= index);
}

/** The new flag parameter of each overload signature of `fn`, or `null` when one of them cannot be rewritten. */
function signatureEdits(sourceCode: SourceCode, fn: FunctionNode, name: string): Array<{ parameter: Parameter; text: string | null }> | null {
  const index = fn.params.length - 1;
  const signatures = overloadSignatures(fn)
    .filter((signature) => index < signature.params.length)
    .map((signature) => ({ parameter: signature.params[index], text: signatureParameter(sourceCode, signature.params[index], name) }));
  return signatures.some((signature) => signature.text === null) ? null : signatures;
}

/**
 * The new text of an overload signature's flag parameter, `options?: { verbose?: boolean }`, or `null` when it is not a
 * plain annotated name. A signature names the object instead of destructuring it, because an optional binding pattern
 * does not type-check there.
 */
function signatureParameter(sourceCode: SourceCode, parameter: Parameter | undefined, name: string): string | null {
  if (parameter?.type !== "Identifier" || !parameter.typeAnnotation) return null;
  const optional = parameter.optional ? "?" : "";
  const taken = isOptionsNameTaken(parameter);
  return `${taken ? `${name}Options` : "options"}${optional}: { ${name}${optional}: ${sourceCode.getText(parameter.typeAnnotation.typeAnnotation as never)} }`;
}

/** Whether another parameter of the signature `parameter` belongs to is already named `options`. */
function isOptionsNameTaken(parameter: TSESTree.Identifier): boolean {
  const signature = parameter.parent as TSESTree.TSDeclareFunction;
  return signature.params.some((other) => other !== parameter && other.type === "Identifier" && other.name === "options");
}

/**
 * The options object that replaces the flag: `{ verbose }: { verbose: boolean }` for a required flag, which keeps it a
 * `boolean` in the body, and `{ verbose = false }: { verbose?: boolean } = {}` for an optional one or one with a default.
 */
function optionsParameter(flag: Flag): string {
  if (flag.required) return `{ ${flag.name} }: { ${flag.name}: ${flag.type} }`;
  const pattern = flag.initial === null ? `{ ${flag.name} }` : `{ ${flag.name} = ${flag.initial} }`;
  return flag.type === null ? `${pattern} = {}` : `${pattern}: { ${flag.name}?: ${flag.type} } = {}`;
}

/** The fix's edit to one call's flag argument, if it passes one: the argument becomes `{ name: argument }`. */
function argumentFix(fixer: Rule.RuleFixer, argument: TSESTree.Expression | undefined, name: string): Rule.Fix[] {
  if (!argument) return [];
  if (argument.type === "Identifier" && argument.name === name) return [fixer.replaceText(argument as never, `{ ${name} }`)];
  const sequence = argument.type === "SequenceExpression";
  return [fixer.insertTextBefore(argument as never, `{ ${name}: ${sequence ? "(" : ""}`), fixer.insertTextAfter(argument as never, `${sequence ? ")" : ""} }`)];
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
    const flagged: FlaggedParameter[] = [];
    /** A direct `eval` anywhere can read `arguments` or call the function, so flags are reported at the end, once the whole file is known. */
    let hasDirectEval = false;
    return {
      ...trackFunctionUsage((fn, usage) => flagged.push(...flaggedParameters(sourceCode, fn, usage))),
      CallExpression(node) {
        if (isDirectEval(node as TSESTree.CallExpression)) hasDirectEval = true;
      },
      "Program:exit": () => flagged.forEach((found) => reportFlag(context, found, hasDirectEval ? null : fixFor(sourceCode, found))),
    };
  },
});
