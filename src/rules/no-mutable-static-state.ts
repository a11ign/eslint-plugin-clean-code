import type { Rule } from "eslint";
import { defineRule } from "../lib/define-rule.ts";
import { asTs, type Node, type TSESTree } from "../lib/ast.ts";
import { className, classOfBody, keyName, type ClassMember, type ClassNode, memberFunction, memberName, thisOwner, unwrapTs, walk } from "../lib/classes.ts";

type Body = TSESTree.ClassBody;

/** A write a method of the class makes to one of its static members. */
interface StaticWrite {
  field: string;
  method: string;
}

/** Reports each static field of the class at the first method that assigns it. */
function reportStaticWrites(context: Rule.RuleContext, body: Body): void {
  const owner = classOfBody(body);
  const fields = staticFields(body);
  if (fields.size === 0) return;
  for (const { field, method } of firstWritePerField(staticWrites(body, ownName(owner)), fields)) {
    context.report({ node: fields.get(field) as never, messageId: "mutableStatic", data: { field, className: className(owner), method } });
  }
}

/** Each write a method of the class makes to one of its static members, in member order. */
function staticWrites(body: Body, name: string | null): StaticWrite[] {
  return body.body.flatMap((member) => memberStaticWrites(member, body, name));
}

/** The writes one member, when it is a method, makes to the class's static members. */
function memberStaticWrites(member: ClassMember, body: Body, name: string | null): StaticWrite[] {
  const fn = memberFunction(member);
  if (!fn) return [];
  const method = memberName(member) ?? "(computed)";
  const fields = writeTargets(fn).map((target) => staticTarget(target, body, name));
  return fields.filter((field): field is string => Boolean(field)).map((field) => ({ field, method }));
}

/** The static field a write target names: `Class.x`, `Class.#x`, or `this.x` where `this` is the class (a static member). */
function staticTarget(target: Node, body: Body, name: string | null): string | null {
  const expression = unwrapTs(target);
  if (expression.type !== "MemberExpression") return null;
  const object = unwrapTs(expression.object);
  const member = keyName(expression.property, expression.computed);
  if (object.type === "Identifier" && object.name === name) return member;
  if (object.type !== "ThisExpression") return null;
  const owner = thisOwner(object);
  return owner?.body === body && owner.isStatic ? member : null;
}

/** The node each write in `root` assigns to: assignments, `++`/`--`, and `delete`. */
function writeTargets(root: Node): Node[] {
  const targets: Node[] = [];
  walk(
    root,
    (node) => {
      if (node.type === "AssignmentExpression" || node.type === "UpdateExpression") targets.push(node.type === "AssignmentExpression" ? node.left : node.argument);
      else if (node.type === "UnaryExpression" && node.operator === "delete") targets.push(node.argument);
    },
    true,
  );
  return targets;
}

/** The static data fields of a class, by name. */
function staticFields(body: Body): Map<string, TSESTree.PropertyDefinition> {
  const fields = new Map<string, TSESTree.PropertyDefinition>();
  for (const member of body.body.filter(isStaticDataField)) {
    const name = memberName(member);
    if (name) fields.set(name, member);
  }
  return fields;
}

function isStaticDataField(member: ClassMember): member is TSESTree.PropertyDefinition {
  return member.type === "PropertyDefinition" && member.static && !memberFunction(member);
}

/** The class's own name, which its methods use to reach its static members: its id, or the variable it is assigned to. */
function ownName(owner: ClassNode): string | null {
  if (owner.id) return owner.id.name;
  const parent = owner.parent;
  return parent?.type === "VariableDeclarator" && parent.id.type === "Identifier" ? parent.id.name : null;
}

/** The first write to each declared static field. */
function firstWritePerField(writes: StaticWrite[], fields: Map<string, TSESTree.PropertyDefinition>): StaticWrite[] {
  const seen = new Set<string>();
  return writes.filter(({ field }) => {
    if (!fields.has(field) || seen.has(field)) return false;
    seen.add(field);
    return true;
  });
}

export default defineRule({
  name: "no-mutable-static-state",
  type: "problem",
  description: "Methods share state through instance fields, not through static fields they assign.",
  book: {
    entry: "ONE-05",
    chapter: "10 One Thing § Extraction and Classes",
    passage: "Those static variables could get corrupted in a multithreaded environment. This is easy enough to correct by changing all the functions and variables from `static` to instance methods and variables.",
  },
  messages: {
    mutableStatic: {
      problem: "Static field `{{field}}` of class `{{className}}` is assigned in the method `{{method}}()`, so every caller shares and changes one copy of it.",
      refactor: "make the field and the methods that share it instance members, and create an instance for each use (`new {{className}}().run()`).",
    },
  },
  create(context) {
    return {
      ClassBody(node) {
        reportStaticWrites(context, asTs<Body>(node));
      },
    };
  },
});
