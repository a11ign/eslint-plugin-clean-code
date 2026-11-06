import type ts from "typescript";
import { defineRule } from "../lib/define-rule.ts";
import { asTs, type Node, type TSESTree } from "../lib/ast.ts";
import { classOrInterfaceOf, isFunctionLikeDeclaration, isNonPublicState, isProjectClass, isProjectDeclaration, isTopType, nonNullableTypeAt, unionMembers, type TypeServices, typeServices } from "../lib/types.ts";

function unwrap(node: Node): Node {
  if (node.type === "TSNonNullExpression" || node.type === "ChainExpression") return unwrap(node.expression);
  return node;
}

/** `a.b()` in `a.b().c()`: a call of a method, made on the result of another method call. */
interface InnerCall {
  call: TSESTree.CallExpression;
  member: TSESTree.MemberExpression;
}

function innerMethodCall(call: TSESTree.CallExpression): InnerCall | null {
  const callee = unwrap(call.callee);
  if (callee.type !== "MemberExpression") return null;
  const inner = unwrap(callee.object);
  if (inner.type !== "CallExpression") return null;
  const member = unwrap(inner.callee);
  return member.type === "MemberExpression" ? { call: inner, member } : null;
}

function declarationsOf(property: ts.Symbol): ts.Declaration[] {
  return property.getDeclarations() ?? [];
}

/**
 * An *object* in the book's sense: an instance of a class declared in the project, with at least one method and at
 * least one `private`, `protected` or `#private` field. Interfaces, type aliases and classes with only public fields are
 * data structures, and library types are left out.
 */
function isBookObject(services: TypeServices, type: ts.Type): boolean {
  const owner = classOrInterfaceOf(services.checker, type);
  if (!owner || !isProjectClass(services, owner.symbol)) return false;
  const declarations = services.checker.getPropertiesOfType(type).flatMap(declarationsOf);
  return declarations.some(isFunctionLikeDeclaration) && declarations.some(isNonPublicState);
}

function isObjectResult(services: TypeServices, type: ts.Type): boolean {
  if (isTopType(services.checker, type)) return false;
  return unionMembers(type).every((member) => isBookObject(services, member));
}

/** The class a receiver is an instance of, or, for a class reference (`Complex.from(…)`), the class it constructs. */
function receiverClasses(services: TypeServices, receiver: Node): Set<ts.Symbol> {
  const type = nonNullableTypeAt(services, receiver);
  const constructed = type.getConstructSignatures().map((signature) => services.checker.getReturnTypeOfSignature(signature));
  return new Set([type, ...constructed].flatMap(unionMembers).flatMap((member) => member.getSymbol() ?? []));
}

/** A fluent call (`builder.limit(10).build()`) or a static factory (`Complex.from(1).add(z)`): the result is the receiver's own type. */
function isFluent(services: TypeServices, inner: InnerCall, result: ts.Type): boolean {
  const own = receiverClasses(services, inner.member.object);
  return unionMembers(result).every((member) => {
    const symbol = member.getSymbol();
    return symbol !== undefined && own.has(symbol);
  });
}

/**
 * A method of a library or `node_modules` type (`this.buckets.get(key)`, `items.find(…)`): the element comes out of a
 * standard container, which is how a class holds its objects in its fields.
 */
function isLibraryMethod(services: TypeServices, inner: InnerCall): boolean {
  const receiver = nonNullableTypeAt(services, inner.member.object);
  const declarations = unionMembers(receiver).flatMap((member) => member.getSymbol()?.getDeclarations() ?? []);
  return declarations.length > 0 && declarations.every((declaration) => !isProjectDeclaration(services.program, declaration));
}

function memberName(member: TSESTree.MemberExpression, context: { sourceCode: { getText: (node: never) => string } }): string {
  return member.property.type === "Identifier" && !member.computed ? member.property.name : context.sourceCode.getText(member.property as never);
}

export default defineRule({
  name: "law-of-demeter",
  type: "suggestion",
  description: "Do not call methods on objects returned by other method calls: talk to friends, not to strangers.",
  book: {
    entry: "OBJ-01",
    chapter: "12 Objects and Data Structures § The Law of Demeter",
    passage: "The method should not invoke methods on objects that are returned by any of the allowed functions. In other words, be shy, talk to friends, and don't talk to strangers.",
  },
  requiresTypeChecking: true,
  messages: {
    stranger: {
      problem: "`{{method}}()` is called on the `{{type}}` object that `{{inner}}()` returns, which this code did not create, receive or hold in a field.",
      refactor: "Tell the Other Guy: give the object this code already knows a method that does the whole job (`registry.addTo(key, item)`), instead of reaching through it to the object it returns.",
    },
  },
  create(context) {
    const services = typeServices(context);
    if (!services) return {};
    return {
      CallExpression(node) {
        const call = asTs<TSESTree.CallExpression>(node);
        const inner = innerMethodCall(call);
        if (!inner) return;
        const result = nonNullableTypeAt(services, inner.call);
        if (!isObjectResult(services, result) || isFluent(services, inner, result) || isLibraryMethod(services, inner)) return;
        const outer = unwrap(call.callee) as TSESTree.MemberExpression;
        context.report({
          node: outer.property as never,
          messageId: "stranger",
          data: { method: memberName(outer, context), inner: memberName(inner.member, context), type: services.checker.typeToString(result) },
        });
      },
    };
  },
});
