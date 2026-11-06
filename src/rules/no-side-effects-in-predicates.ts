import type { Rule } from "eslint";
import { defineRule } from "../lib/define-rule.ts";
import { asTs, isFunction, type FunctionNode, type Node, type TSESTree } from "../lib/ast.ts";
import { lookUp, predicateCandidateName, unwrapTypeScript, type VariableT } from "../lib/naming.ts";

const PREDICATE = /^(is|has|can|should)[A-Z]/;

function predicateName(node: Node): string | null {
  if (!isFunction(node)) return null;
  const name = predicateCandidateName(node);
  return name && PREDICATE.test(name) ? name : null;
}

/** The identifiers and member expressions a write target (possibly a destructuring pattern) assigns to. */
function writeTargets(target: Node | null): Node[] {
  const node = unwrapTypeScript(target);
  if (!node) return [];
  switch (node.type) {
    case "Identifier":
    case "MemberExpression":
      return [node];
    case "ArrayPattern":
      return node.elements.flatMap((element) => writeTargets(element));
    case "ObjectPattern":
      return node.properties.flatMap((property) => writeTargets(property.type === "Property" ? property.value : property));
    case "AssignmentPattern":
      return writeTargets(node.left);
    case "RestElement":
      return writeTargets(node.argument);
    default:
      return [];
  }
}

/** The object at the start of a member chain: `this` in `this.a.b`, `p` in `p.x[0]`. */
function chainRoot(member: TSESTree.MemberExpression): Node {
  let current: Node = member;
  while (current.type === "MemberExpression") current = unwrapTypeScript(current.object) as Node;
  return current;
}

/** The predicate whose `this` a write in `node` changes: the nearest function around it, looking through arrows. */
function predicateOwningThis(node: Node): FunctionNode | null {
  for (let current = node.parent; current; current = current.parent) {
    if (current.type === "PropertyDefinition" || current.type === "AccessorProperty" || current.type === "StaticBlock") return null;
    if (!isFunction(current)) continue;
    if (predicateName(current)) return current;
    if (current.type !== "ArrowFunctionExpression") return null;
  }
  return null;
}

function within(node: Node, outer: Node): boolean {
  return node.range[0] >= outer.range[0] && node.range[1] <= outer.range[1];
}

/** Whether writing to `variable` (or, for `property`, to one of its properties) from inside `predicate` reaches outside it. */
function reachesOutside(variable: VariableT | null, predicate: FunctionNode, property: boolean): boolean {
  if (!variable) return true;
  if (!within(asTs(variable.defs[0].name), predicate)) return true;
  return property && variable.defs.some((def) => def.type === "Parameter" && asTs(def.node) === predicate);
}

/** The predicate around `identifier` that a write to it (or to its property) has a side effect on. */
function predicateAffectedBy(identifier: TSESTree.Identifier, variable: VariableT | null, property: boolean): FunctionNode | null {
  for (let current: Node | undefined = identifier.parent; current; current = current.parent) {
    if (predicateName(current) && reachesOutside(variable, current as FunctionNode, property)) return current as FunctionNode;
  }
  return null;
}

export default defineRule({
  name: "no-side-effects-in-predicates",
  type: "problem",
  description: "A function named as a predicate (`is…`, `has…`, `can…`, `should…`) must not assign to anything declared outside it.",
  book: {
    entry: "NAM-12",
    chapter: "4 Meaningful Names § Method Names; Appendix, The Clean Code Debate",
    passage: "If a reader trusts the name `isMultipleOfNthPrimeFactor` (which suggests a predicate with no side effects) and doesn't bother to read its code, they will not realize that it has side effects",
  },
  messages: {
    sideEffect: {
      problem: "Predicate `{{name}}` assigns to `{{target}}`, which is declared outside it.",
      refactor: "move the change out of the predicate into a separately named command, or, if the change is the point, rename the function for what it does.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const reportWrite = (write: Node, target: Node, predicate: FunctionNode) => {
      context.report({ node: write as never, messageId: "sideEffect", data: { name: predicateName(predicate) as string, target: sourceCode.getText(target as never) } });
    };
    const check = (write: Node, target: Node) => {
      const root = target.type === "MemberExpression" ? chainRoot(target) : target;
      let predicate: FunctionNode | null = null;
      if (root.type === "ThisExpression" || root.type === "Super") predicate = predicateOwningThis(write);
      else if (root.type === "Identifier") predicate = predicateAffectedBy(root, lookUp(sourceCode.getScope(root as never), root.name), target !== root);
      if (predicate) reportWrite(write, target, predicate);
    };
    const checkAll = (write: Node, left: Node | null) => {
      for (const target of writeTargets(left)) check(write, target);
    };
    return {
      AssignmentExpression: (node: unknown) => checkAll(asTs(node), asTs<TSESTree.AssignmentExpression>(node).left),
      UpdateExpression: (node: unknown) => checkAll(asTs(node), asTs<TSESTree.UpdateExpression>(node).argument),
      "ForInStatement, ForOfStatement"(node: unknown) {
        const loop = asTs<TSESTree.ForInStatement | TSESTree.ForOfStatement>(node);
        if (loop.left.type !== "VariableDeclaration") checkAll(loop, loop.left);
      },
    } as Rule.RuleListener;
  },
});
