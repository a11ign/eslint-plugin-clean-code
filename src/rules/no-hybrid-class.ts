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

/**
 * Instance field declarations that anyone can write: not `private`, `#`, `protected`, `readonly` or a function, and not
 * `declare`, which only types a field and creates nothing at run time.
 */
function declaredPublicFields(body: Body): string[] {
  const fields = body.body.filter(isPublicDataField).map((member) => memberName(member));
  const parameters = parameterProperties(body).filter((param) => !param.readonly && !isHidden(param)).map((param) => parameterPropertyName(param));
  return [...fields, ...parameters].filter((name): name is string => Boolean(name));
}

function isPublicDataField(member: TSESTree.ClassElement): member is TSESTree.PropertyDefinition {
  return member.type === "PropertyDefinition" && isMutableInstanceField(member) && isPublicData(member);
}

function isMutableInstanceField(member: TSESTree.PropertyDefinition): boolean {
  return !member.static && !member.readonly && !member.declare;
}

/** Not hidden (`private`, `#`, `protected`), and holding data rather than a function. */
function isPublicData(member: TSESTree.PropertyDefinition): boolean {
  return !isHidden(member) && !isFunction(member.value);
}

/** Fields the constructor creates with `this.x = …` without declaring them. */
function undeclaredConstructorFields(body: Body): string[] {
  const constructor = constructorOf(body);
  if (!constructor) return [];
  const declared = new Set([...body.body.map((member) => memberName(member)), ...parameterProperties(body).map((param) => parameterPropertyName(param))]);
  const names = new Set<string>();
  walk(constructor.body, (node) => {
    const name = node.type === "AssignmentExpression" ? thisMemberName(node.left) : null;
    if (name && !name.startsWith("#") && !declared.has(name)) names.add(name);
  });
  return [...names];
}

/** The first instance method with behaviour: not the constructor, an accessor, or a method whose every `return` returns `this`. */
function behaviourMethod(body: Body): string | null {
  const method = body.body.find(isBehaviourMethod);
  return method ? (memberName(method) ?? "(computed)") : null;
}

function isBehaviourMethod(member: TSESTree.ClassElement): boolean {
  if (member.type === "StaticBlock" || member.type === "TSIndexSignature" || member.static) return false;
  if (member.type === "MethodDefinition" && member.kind !== "method") return false;
  const fn = memberFunction(member);
  return fn ? !returnsOnlyThis(fn) : false;
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
        const method = field ? behaviourMethod(body) : null;
        if (!field || !method) return;
        const owner = classOfBody(body);
        context.report({ node: (owner.id ?? owner) as never, messageId: "hybrid", data: { name: className(owner), field, method } });
      },
    };
  },
});
