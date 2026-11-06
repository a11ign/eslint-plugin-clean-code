import type ts from "typescript";
import { defineRule } from "../lib/define-rule.ts";
import { asTs, functionName, type FunctionNode, type Node } from "../lib/ast.ts";
import { isTopType, typeServices } from "../lib/types.ts";

/** The predicate prefixes of NAM-12, followed by the start of the next camel-case word: `isEmpty`, `hasItems`, `canRetry`, `shouldStop`. */
const PREDICATE_NAME = /^(is|has|can|should)[A-Z]/;

/** A setter's name is the property's, not a question the function answers. */
function isSetter(node: FunctionNode): boolean {
  const parent = node.parent;
  return (parent?.type === "MethodDefinition" || parent?.type === "Property") && parent.kind === "set";
}

/** `boolean`, `true`, `false`, a type predicate, or a promise of one of them. `any` is left alone: it says nothing. */
function isBooleanResult(checker: ts.TypeChecker, returnType: ts.Type): boolean {
  const awaited = checker.getAwaitedType(returnType) ?? returnType;
  if (isTopType(checker, awaited)) return true;
  return checker.isTypeAssignableTo(awaited, checker.getBooleanType());
}

/** Where to report: the function's name, wherever it is written. */
function nameNode(node: FunctionNode): Node {
  if (node.id) return node.id;
  const parent = node.parent;
  if (parent?.type === "VariableDeclarator") return parent.id;
  if (parent?.type === "MethodDefinition" || parent?.type === "Property" || parent?.type === "PropertyDefinition") return parent.key;
  return node;
}

export default defineRule({
  name: "predicate-returns-boolean",
  type: "suggestion",
  description: "A function named as a question (`is`, `has`, `can`, `should`) returns a boolean.",
  book: {
    entry: "NAM-12",
    chapter: "4 Meaningful Names § Method Names; Appendix, The Clean Code Debate",
    passage: "If a reader trusts the name `isMultipleOfNthPrimeFactor` (which suggests a predicate with no side effects) and doesn't bother to read its code, they will not realize that it has side effects",
  },
  requiresTypeChecking: true,
  messages: {
    notBoolean: {
      problem: "`{{name}}` is named as a predicate, but it returns `{{type}}`, not a boolean.",
      refactor: "name the function for the value it returns (`findUser`, `countItems`), or make it answer the question with `true` or `false`; a reader who trusts the predicate's name will not read its body.",
    },
  },
  create(context) {
    const services = typeServices(context);
    if (!services) return {};
    const check = (node: unknown): void => {
      const fn = asTs<FunctionNode>(node);
      const name = functionName(fn);
      if (!name || !PREDICATE_NAME.test(name) || isSetter(fn)) return;
      const signature = services.checker.getSignatureFromDeclaration(services.tsNode(fn) as ts.SignatureDeclaration);
      if (!signature) return;
      const returnType = services.checker.getReturnTypeOfSignature(signature);
      if (isBooleanResult(services.checker, returnType)) return;
      context.report({
        node: nameNode(fn) as never,
        messageId: "notBoolean",
        data: { name, type: services.checker.typeToString(returnType) },
      });
    };
    return { FunctionDeclaration: check, FunctionExpression: check, ArrowFunctionExpression: check };
  },
});
