import type ts from "typescript";
import { defineRule } from "../lib/define-rule.ts";
import { asTs, type Node, type TSESTree } from "../lib/ast.ts";
import { classOrInterfaceOf, inheritsFrom, isProjectDeclaration, isTopType, type TypeServices, typeServices } from "../lib/types.ts";

/**
 * The declared type of the checked value: a variable's, parameter's or property's own declared type, not the type it
 * is narrowed to at this point, so that an `else if` chain of checks is judged against the same type each time.
 */
function declaredType(services: TypeServices, node: Node): ts.Type {
  const { checker } = services;
  const tsNode = services.tsNode(node);
  const symbol = checker.getSymbolAtLocation(tsNode);
  const declaration = symbol?.valueDeclaration;
  const type = symbol && declaration ? checker.getTypeOfSymbol(symbol) : checker.getTypeAtLocation(tsNode);
  return isTopType(checker, type) ? type : checker.getNonNullableType(type);
}

/** The class or interface `T` the value is declared as, when it is declared in the project. */
function projectSupertype(services: TypeServices, type: ts.Type): ts.Symbol | null {
  if (type.isUnion() || isTopType(services.checker, type)) return null;
  const owner = classOrInterfaceOf(services.checker, type);
  if (!owner) return null;
  const declarations = owner.symbol.getDeclarations() ?? [];
  return declarations.length > 0 && declarations.every((declaration) => isProjectDeclaration(services.program, declaration)) ? owner.symbol : null;
}

/** The class `S` that `x instanceof S` tests for: what the right-hand side constructs. */
function testedClass(services: TypeServices, node: Node): ts.Symbol | null {
  const { checker } = services;
  const [construct] = checker.getTypeAtLocation(services.tsNode(node)).getConstructSignatures();
  if (!construct) return null;
  return checker.getReturnTypeOfSignature(construct).getSymbol() ?? null;
}

export default defineRule({
  name: "no-subtype-check",
  type: "suggestion",
  description: "Do not test whether a value is a particular subtype of its declared type.",
  book: {
    entry: "SOL-03",
    chapter: "19 The SOLID Principles § LSP",
    passage: "Since the behavior of the `User` depends on the types it uses, those types are not substitutable.",
  },
  requiresTypeChecking: true,
  messages: {
    subtypeCheck: {
      problem: "`instanceof {{subtype}}` special-cases one subtype of `{{type}}`, so this code depends on which `{{type}}` it is given.",
      refactor: "move the behaviour that varies into the subtypes, as a method of `{{type}}` that each subtype implements, and call that method instead of testing the type.",
    },
  },
  create(context) {
    const services = typeServices(context);
    if (!services) return {};
    return {
      BinaryExpression(node) {
        const test = asTs<TSESTree.BinaryExpression>(node);
        if (test.operator !== "instanceof") return;
        const supertype = projectSupertype(services, declaredType(services, test.left));
        const subtype = testedClass(services, test.right);
        if (!supertype || !subtype || subtype === supertype || !inheritsFrom(services.checker, subtype, supertype)) return;
        context.report({ node: node as never, messageId: "subtypeCheck", data: { subtype: subtype.getName(), type: supertype.getName() } });
      },
    };
  },
});
