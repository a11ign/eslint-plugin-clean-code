import type ts from "typescript";
import { defineRule } from "../lib/define-rule.ts";
import { asTs, type TSESTree } from "../lib/ast.ts";
import { hasBody, hasModifier, isProjectClass, isProjectDeclaration, type TypeServices, typeServices } from "../lib/types.ts";

type ClassNode = TSESTree.ClassDeclaration | TSESTree.ClassExpression;

/** The class `node` extends, when it is a class (not a mixin's intersection or an `any`). */
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

/** The concrete project method (or accessor) of the base class that `name` overrides, as `Class.method`, or `null`. */
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
    const check = (node: unknown): void => {
      const cls = asTs<ClassNode>(node);
      if (!cls.superClass) return;
      const base = baseClass(services, cls);
      if (!base || !isProjectClass(services, base.symbol)) return;
      const name = cls.id?.name ?? "(anonymous class)";
      if (!isAbstractClass(base.symbol)) {
        context.report({ node: cls.superClass as never, messageId: "concreteBase", data: { name, base: base.symbol.getName() } });
      }
      for (const member of cls.body.body) {
        if (member.type !== "MethodDefinition" || member.kind === "constructor" || member.static || !member.value.body) continue;
        const method = memberName(member);
        const overridden = method === null ? null : overriddenConcrete(services, base.type, method);
        if (overridden) context.report({ node: member.key as never, messageId: "concreteOverride", data: { method: `${name}.${method}`, base: overridden } });
      }
    };
    return { ClassDeclaration: check, ClassExpression: check };
  },
});
