import { defineRule } from "../lib/define-rule.ts";
import { asTs, isFunction, type TSESTree } from "../lib/ast.ts";
import {
  className,
  classOfBody,
  constructorOf,
  isHidden,
  memberFunction,
  memberName,
  parameterProperties,
  parameterPropertyName,
  returnsOnlyThis,
  thisMemberName,
  walk,
} from "../lib/classes.ts";

type Body = TSESTree.ClassBody;

/** Instance field declarations that anyone can write: not `private`, `#`, `protected`, `readonly` or a function. */
function declaredPublicFields(body: Body): string[] {
  const names: string[] = [];
  for (const member of body.body) {
    if (member.type !== "PropertyDefinition" || member.static || member.readonly || isHidden(member) || isFunction(member.value)) continue;
    const name = memberName(member);
    if (name) names.push(name);
  }
  for (const param of parameterProperties(body)) {
    const name = parameterPropertyName(param);
    if (name && !param.readonly && !isHidden(param)) names.push(name);
  }
  return names;
}

/** Fields the constructor creates with `this.x = …` without declaring them. */
function undeclaredConstructorFields(body: Body): string[] {
  const constructor = constructorOf(body);
  if (!constructor) return [];
  const declared = new Set(body.body.map((member) => memberName(member)));
  for (const param of parameterProperties(body)) declared.add(parameterPropertyName(param));
  const names: string[] = [];
  walk(constructor.body, (node) => {
    if (node.type !== "AssignmentExpression") return;
    const name = thisMemberName(node.left);
    if (name && !name.startsWith("#") && !declared.has(name) && !names.includes(name)) names.push(name);
  });
  return names;
}

/** The first instance method with behaviour: not the constructor, an accessor, or a method whose every `return` returns `this`. */
function behaviourMethod(body: Body): string | null {
  for (const member of body.body) {
    if (member.type === "StaticBlock" || member.type === "TSIndexSignature" || member.static) continue;
    if (member.type === "MethodDefinition" && member.kind !== "method") continue;
    const fn = memberFunction(member);
    if (!fn || returnsOnlyThis(fn)) continue;
    return memberName(member) ?? "(computed)";
  }
  return null;
}

export default defineRule({
  name: "no-hybrid-class",
  type: "suggestion",
  description: "A class is either an object (hidden data, public behaviour) or a data structure (public data, no behaviour), not both.",
  book: {
    entry: "OBJ-04",
    chapter: "12 Objects and Data Structures § Hybrids",
    passage: "Such hybrids make it hard to add new functions but also make it hard to add new data structures. They are the worst of both worlds. Avoid creating them.",
  },
  messages: {
    hybrid: {
      problem: "Class `{{name}}` is a hybrid: it exposes the public mutable field `{{field}}` and has the behaviour method `{{method}}()`.",
      refactor: "choose one: make it an object (make its fields private and expose only behaviour), or a data structure (public fields, with the behaviour moved into functions that operate on it).",
    },
  },
  create(context) {
    return {
      ClassBody(node) {
        const body = asTs<Body>(node);
        const field = declaredPublicFields(body)[0] ?? undeclaredConstructorFields(body)[0];
        if (!field) return;
        const method = behaviourMethod(body);
        if (!method) return;
        const owner = classOfBody(body);
        context.report({ node: (owner.id ?? owner) as never, messageId: "hybrid", data: { name: className(owner), field, method } });
      },
    };
  },
});
