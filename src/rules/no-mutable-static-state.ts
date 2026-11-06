import { defineRule } from "../lib/define-rule.ts";
import { asTs, type Node, type TSESTree } from "../lib/ast.ts";
import { className, classOfBody, keyName, type ClassNode, memberFunction, memberName, thisOwner, unwrapTs, walk } from "../lib/classes.ts";

type Body = TSESTree.ClassBody;

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

/** The class's own name, which its methods use to reach its static members: its id, or the variable it is assigned to. */
function ownName(owner: ClassNode): string | null {
  if (owner.id) return owner.id.name;
  const parent = owner.parent;
  return parent?.type === "VariableDeclarator" && parent.id.type === "Identifier" ? parent.id.name : null;
}

/** The static data fields of a class, by name. */
function staticFields(body: Body): Map<string, TSESTree.PropertyDefinition> {
  const fields = new Map<string, TSESTree.PropertyDefinition>();
  for (const member of body.body) {
    if (member.type !== "PropertyDefinition" || !member.static || memberFunction(member)) continue;
    const name = memberName(member);
    if (name) fields.set(name, member);
  }
  return fields;
}

/** Each write a method of the class makes to one of its static members, in member order. */
function staticWrites(body: Body, name: string | null): Array<{ field: string; method: string }> {
  const writes: Array<{ field: string; method: string }> = [];
  for (const member of body.body) {
    const fn = memberFunction(member);
    if (!fn) continue;
    const method = memberName(member) ?? "(computed)";
    for (const target of writeTargets(fn)) {
      const field = staticTarget(target, body, name);
      if (field) writes.push({ field, method });
    }
  }
  return writes;
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
        const body = asTs<Body>(node);
        const owner = classOfBody(body);
        const fields = staticFields(body);
        if (fields.size === 0) return;
        const reported = new Set<string>();
        for (const { field, method } of staticWrites(body, ownName(owner))) {
          const declaration = fields.get(field);
          if (!declaration || reported.has(field)) continue;
          reported.add(field);
          context.report({ node: declaration as never, messageId: "mutableStatic", data: { field, className: className(owner), method } });
        }
      },
    };
  },
});
