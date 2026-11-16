import type ts from "typescript";
import type { Rule } from "eslint";
import { defineRule } from "../lib/define-rule.ts";
import { asTs, type TSESTree } from "../lib/ast.ts";
import { hasBody, hasModifier, isProjectClass, isProjectDeclaration, type TypeServices, typeServices } from "../lib/types.ts";

type ClassNode = TSESTree.ClassDeclaration | TSESTree.ClassExpression;

/** A method of a subclass that overrides a concrete method of its project base class. */
interface ConcreteOverride {
  member: TSESTree.MethodDefinition;
  method: string;
  overridden: string;
}

function checkClass(context: Rule.RuleContext, services: TypeServices, cls: ClassNode): void {
  const base = cls.superClass ? baseClass(services, cls) : null;
  if (!base || !isProjectClass(services, base.symbol)) return;
  const name = cls.id?.name ?? "(anonymous class)";
  if (!isAbstractClass(base.symbol)) context.report({ node: cls.superClass as never, messageId: "concreteBase", data: { name, base: base.symbol.getName() } });
  for (const { member, method, overridden } of concreteOverrides(services, base.type, cls.body.body)) {
    context.report({ node: member.key as never, messageId: "concreteOverride", data: { method: `${name}.${method}`, base: overridden } });
  }
}

/** The class `node` extends, read through `services`, when it is a class (not a mixin's intersection or an `any`). */
function baseClass(services: TypeServices, node: ClassNode): { type: ts.Type; symbol: ts.Symbol } | null {
  const { checker } = services;
  const type = checker.getTypeAtLocation(services.tsNode(node));
  const classSymbol = type.getSymbol();
  const own = classSymbol ? checker.getDeclaredTypeOfSymbol(classSymbol) : type;
  if (!own.isClassOrInterface()) return null;
  const [base] = checker.getBaseTypes(own);
  const symbol = base?.getSymbol();
  if (!base || !symbol || !checker.getDeclaredTypeOfSymbol(symbol).isClass()) return null;
  return { type: base, symbol };
}

function isAbstractClass(symbol: ts.Symbol): boolean {
  return (symbol.getDeclarations() ?? []).some((declaration) => hasModifier(declaration, "abstract"));
}

function concreteOverrides(services: TypeServices, base: ts.Type, members: TSESTree.ClassElement[]): ConcreteOverride[] {
  return members.filter(isOverridableMethod).flatMap((member) => {
    const method = memberName(member);
    if (method === null) return [];
    const overridden = overriddenConcrete(services, base, method);
    return overridden ? [{ member, method, overridden }] : [];
  });
}

/** Whether `member` is an instance method with a body: constructors, static methods and overload signatures override nothing. */
function isOverridableMethod(member: TSESTree.ClassElement): member is TSESTree.MethodDefinition {
  return member.type === "MethodDefinition" && isInstanceMethod(member) && Boolean(member.value.body);
}

function isInstanceMethod(member: TSESTree.MethodDefinition): boolean {
  return member.kind !== "constructor" && !member.static;
}

/**
 * The concrete method (or accessor) of the `base` class that `name` overrides, as `Class.method`, or `null`. Only a method
 * the program of `services` counts as the project's own code is concrete here.
 */
function overriddenConcrete(services: TypeServices, base: ts.Type, name: string): string | null {
  const property = base.getProperty(name);
  const concrete = (property?.getDeclarations() ?? []).find((declaration) => hasBody(declaration) && isProjectDeclaration(services.program, declaration));
  if (!concrete) return null;
  const owner = (concrete.parent as { name?: ts.Node } | undefined)?.name?.getText() ?? "(anonymous)";
  return `${owner}.${name}`;
}

function memberName(member: TSESTree.MethodDefinition): string | null {
  if (member.computed) return null;
  if (member.key.type === "Identifier") return member.key.name;
  return member.key.type === "Literal" ? String(member.key.value) : null;
}

export default defineRule({
  name: "no-concrete-inheritance",
  type: "suggestion",
  description: "Do not extend a concrete class of the project, and do not override its concrete methods.",
  book: {
    entry: "SOL-05, SOL-06",
    chapter: "19 The SOLID Principles § Stable Abstractions",
    passage: "In statically typed languages, inheritance is the strongest and most rigid of all the source code relationships, and it should be used with great care.",
  },
  requiresTypeChecking: true,
  messages: {
    concreteBase: {
      problem: "`{{name}}` extends `{{base}}`, a concrete class of this project, so it depends on every detail of that class.",
      refactor: "don't derive from volatile concrete classes: make `{{base}}` abstract, or have both classes implement an interface and give `{{name}}` the other one as a field.",
    },
    concreteOverride: {
      problem: "`{{method}}` overrides the concrete function `{{base}}`, and inherits the source code dependencies it has.",
      refactor: "don't override concrete functions: make the function abstract in the base class and give each subclass its own implementation.",
    },
  },
  create(context) {
    const services = typeServices(context);
    if (!services) return {};
    const check = (node: unknown): void => checkClass(context, services, asTs<ClassNode>(node));
    return { ClassDeclaration: check, ClassExpression: check };
  },
});
