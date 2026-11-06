import type { Scope, SourceCode } from "eslint";
import type * as ts from "typescript";
import { defineRule } from "../lib/define-rule.ts";
import { asTs, isFunction, type FunctionNode, type Node, type TSESTree } from "../lib/ast.ts";
import { findMethod, returnedValues, thisOwner, unwrapTs, walk } from "../lib/classes.ts";

const COMPARISON = new Set(["==", "!=", "===", "!==", "<", ">", "<=", ">=", "instanceof", "in"]);

interface Options {
  checkMethodCalls?: boolean;
}

/** The parts of typescript-eslint's parser services this rule reads, when type information is present. */
interface TypeServices {
  program: ts.Program;
  esTreeNodeToTSNodeMap: { get(node: Node): ts.Node };
  tsNodeToESTreeNodeMap: { get(node: ts.Node): Node | undefined };
}

function findVariable(scope: Scope.Scope | null, name: string): Scope.Variable | null {
  for (let current = scope; current; current = current.upper) {
    const variable = current.variables.find((candidate) => candidate.name === name);
    if (variable) return variable;
  }
  return null;
}

function isInside(node: Node | { range?: [number, number] }, fn: FunctionNode): boolean {
  const range = node.range;
  return Boolean(range) && range![0] >= fn.range[0] && range![1] <= fn.range[1];
}

/** The identifier or `this` a member chain such as `a.b[c].d` starts from. */
function rootOf(expression: Node): Node {
  let current = unwrapTs(expression);
  while (current.type === "MemberExpression") current = unwrapTs(current.object);
  return current;
}

/**
 * Whether writing to `target` from inside `fn` changes state outside `fn`: a member of `this`, of a parameter or of an
 * outer variable, or an outer variable itself. Writing to a local variable, or to a member of a local, does not.
 */
function changesOuterState(sourceCode: SourceCode, target: Node, fn: FunctionNode): boolean {
  const unwrapped = unwrapTs(target);
  const root = rootOf(unwrapped);
  if (root.type === "ThisExpression") return true;
  if (root.type !== "Identifier") return unwrapped.type === "MemberExpression";
  const variable = findVariable(sourceCode.getScope(root as never), root.name);
  const definition = variable?.defs[0];
  if (!definition) return true;
  const declaredInside = isInside(definition.name as Node, fn);
  if (unwrapped.type === "MemberExpression") return !declaredInside || definition.type === "Parameter";
  return !declaredInside;
}

/** The first write in `fn` (including the functions nested in it) to state outside `fn`. */
function outerWrite(sourceCode: SourceCode, fn: FunctionNode): Node | null {
  let found: Node | null = null;
  walk(
    fn,
    (node) => {
      if (found) return;
      const target = node.type === "AssignmentExpression" ? node.left : node.type === "UpdateExpression" ? node.argument : null;
      if (target && changesOuterState(sourceCode, target, fn)) found = target;
    },
    true,
  );
  return found;
}

function isBooleanAnswer(value: TSESTree.Expression | null): boolean {
  if (!value) return false;
  const expression = unwrapTs(value);
  if (expression.type === "Literal") return typeof expression.value === "boolean";
  return expression.type === "BinaryExpression" && COMPARISON.has(expression.operator);
}

/** The function a variable names in this file: a function declaration, or a variable initialised with a function. */
function declaredFunction(variable: Scope.Variable | null): FunctionNode | null {
  const definition = variable?.defs[0];
  if (!definition) return null;
  const node = definition.node as Node;
  if (definition.type === "FunctionName" && isFunction(node)) return node;
  if (definition.type === "Variable" && node.type === "VariableDeclarator" && isFunction(node.init)) return node.init;
  return null;
}

/** The function an ESTree node for a declaration runs: the node itself, or a method's or property's value. */
function functionOfDeclaration(node: Node | undefined): FunctionNode | null {
  if (!node) return null;
  if (isFunction(node)) return node;
  if (node.type === "MethodDefinition" || node.type === "Property" || node.type === "PropertyDefinition") {
    return isFunction(node.value as Node) ? (node.value as FunctionNode) : null;
  }
  return null;
}

/** `obj.method` resolved through the type of `obj`, when the method is declared in the file being linted. */
function typedMethod(services: TypeServices, callee: TSESTree.MemberExpression): FunctionNode | null {
  if (callee.computed || callee.property.type !== "Identifier") return null;
  const checker = services.program.getTypeChecker();
  const object = services.esTreeNodeToTSNodeMap.get(callee.object);
  const type = checker.getApparentType(checker.getTypeAtLocation(object));
  const declarations = checker.getPropertyOfType(type, callee.property.name)?.getDeclarations() ?? [];
  const sourceFile = object.getSourceFile();
  for (const declaration of declarations) {
    if (declaration.getSourceFile() !== sourceFile) continue;
    const fn = functionOfDeclaration(services.tsNodeToESTreeNodeMap.get(declaration));
    if (fn) return fn;
  }
  return null;
}

function typeServices(sourceCode: SourceCode): TypeServices | null {
  const services = sourceCode.parserServices as Partial<TypeServices> | undefined;
  return services?.program && services.esTreeNodeToTSNodeMap && services.tsNodeToESTreeNodeMap ? (services as TypeServices) : null;
}

/** The call a condition makes, through `!`, `?.` and type assertions. */
function conditionCall(test: Node): TSESTree.CallExpression | null {
  let current = unwrapTs(test);
  while (current.type === "UnaryExpression" && current.operator === "!") current = unwrapTs(current.argument);
  if (current.type === "ChainExpression") current = current.expression;
  return current.type === "CallExpression" ? current : null;
}

export default defineRule<[Options]>({
  name: "no-command-query-mix",
  type: "suggestion",
  description: "A function used as a condition either answers something or does something, not both.",
  book: {
    entry: "FH-04",
    chapter: "8 Function Heuristics § Command Query Separation",
    passage: "Under the CQS convention, functions either do something or answer something, but not both.",
  },
  messages: {
    commandAsQuery: {
      problem: "`{{callee}}()` is tested as a condition, but it also changes state (it writes `{{state}}`), so the reader cannot tell whether this asks a question or gives a command.",
      refactor: "separate the command from the query: test a query (`if (attributeExists(\"username\"))`) and call the command on its own (`setAttribute(\"username\", \"unclebob\")`).",
    },
  },
  schema: [
    {
      type: "object",
      properties: {
        checkMethodCalls: {
          type: "boolean",
          default: false,
          description: "Also resolve `obj.method()` through the type of `obj`. Needs type information; without it, the option does nothing.",
        },
      },
      additionalProperties: false,
    },
  ],
  defaultOptions: [{ checkMethodCalls: false }],
  create(context) {
    const sourceCode = context.sourceCode;
    const checkMethodCalls = Boolean((context.options[0] as Options | undefined)?.checkMethodCalls);
    const services = checkMethodCalls ? typeServices(sourceCode) : null;
    const verdicts = new WeakMap<FunctionNode, Node | null>();

    function commandWrite(fn: FunctionNode): Node | null {
      if (!verdicts.has(fn)) verdicts.set(fn, returnedValues(fn).some(isBooleanAnswer) ? outerWrite(sourceCode, fn) : null);
      return verdicts.get(fn) ?? null;
    }

    function resolve(call: TSESTree.CallExpression): FunctionNode | null {
      const callee = unwrapTs(call.callee);
      if (callee.type === "Identifier") return declaredFunction(findVariable(sourceCode.getScope(call as never), callee.name));
      if (callee.type !== "MemberExpression") return null;
      if (unwrapTs(callee.object).type === "ThisExpression") {
        const owner = thisOwner(callee);
        const name = callee.computed || callee.property.type !== "Identifier" ? null : callee.property.name;
        return owner && name ? findMethod(owner, name) : null;
      }
      return services ? typedMethod(services, callee) : null;
    }

    function check(test: Node) {
      const call = conditionCall(test);
      const fn = call && resolve(call);
      const write = fn && commandWrite(fn);
      if (!call || !write) return;
      context.report({
        node: call as never,
        messageId: "commandAsQuery",
        data: { callee: sourceCode.getText(call.callee as never), state: sourceCode.getText(write as never) },
      });
    }

    return {
      IfStatement: (node) => check(asTs<TSESTree.IfStatement>(node).test),
      WhileStatement: (node) => check(asTs<TSESTree.WhileStatement>(node).test),
      ConditionalExpression: (node) => check(asTs<TSESTree.ConditionalExpression>(node).test),
    };
  },
});
