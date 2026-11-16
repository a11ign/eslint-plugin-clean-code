import type { Rule, SourceCode } from "eslint";
import { defineRule } from "../lib/define-rule.ts";
import { asTs, isFunction, type FunctionNode, type Node, type TSESTree } from "../lib/ast.ts";
import { lookUp, predicateCandidateName, unwrapTypeScript, type VariableT } from "../lib/naming.ts";

const PREDICATE = /^(is|has|can|should)[A-Z]/;

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
    const checkAll = (write: Node, left: Node | null) => checkWrites(context, write, left);
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

/** Checks each target `write` assigns to, `left` being its write target, and reports through `context`. */
function checkWrites(context: Rule.RuleContext, write: Node, left: Node | null): void {
  for (const target of writeTargets(left)) checkWrite(context, write, target);
}

function checkWrite(context: Rule.RuleContext, write: Node, target: Node): void {
  const predicate = predicateWrittenBy(context.sourceCode, write, target);
  if (!predicate) return;
  context.report({ node: write as never, messageId: "sideEffect", data: { name: predicateName(predicate) as string, target: context.sourceCode.getText(target as never) } });
}

/**
 * The predicate that `write`, assigning to `target`, has a side effect on: through `this` or `super`, or through a variable
 * declared outside it, looked up in the scopes of `sourceCode`.
 */
function predicateWrittenBy(sourceCode: SourceCode, write: Node, target: Node): FunctionNode | null {
  const root = target.type === "MemberExpression" ? chainRoot(target) : target;
  if (root.type === "ThisExpression" || root.type === "Super") return predicateOwningThis(write);
  if (root.type !== "Identifier") return null;
  return predicateAffectedBy(root, lookUp(sourceCode.getScope(root as never), root.name), { property: target !== root });
}
/** The identifiers and member expressions the write `target` (possibly a destructuring pattern) assigns to. */
function writeTargets(target: Node | null): Node[] {
  const node = unwrapTypeScript(target);
  if (!node) return [];
  if (node.type === "Identifier" || node.type === "MemberExpression") return [node];
  return innerTargets(node).flatMap((inner) => writeTargets(inner));
}

/** The write targets inside `node`, when it is a destructuring pattern or a default value. */
function innerTargets(node: Node): (Node | null)[] {
  if (node.type === "ArrayPattern") return node.elements;
  if (node.type === "ObjectPattern") return node.properties.map((property) => (property.type === "Property" ? property.value : property));
  if (node.type === "AssignmentPattern") return [node.left];
  if (node.type === "RestElement") return [node.argument];
  return [];
}

/** The object at the start of the member chain `member`: `this` in `this.a.b`, `p` in `p.x[0]`. */
function chainRoot(member: TSESTree.MemberExpression): Node {
  let current: Node = member;
  while (current.type === "MemberExpression") current = unwrapTypeScript(current.object) as Node;
  return current;
}

/** The predicate whose `this` a write in `node` changes: the nearest function around it, looking through arrows. */
function predicateOwningThis(node: Node): FunctionNode | null {
  for (let current = node.parent; current; current = current.parent) {
    if (endsThisSearch(current)) return predicateName(current) ? (current as FunctionNode) : null;
  }
  return null;
}

/** Code whose `this` is not the enclosing function's: a field initializer or a static block. */
const OWN_THIS = new Set(["PropertyDefinition", "AccessorProperty", "StaticBlock"]);

/** Whether the search for the `this` a write changes stops at `node`: code with its own `this`, a predicate, or a function that is not an arrow. */
function endsThisSearch(node: Node): boolean {
  if (OWN_THIS.has(node.type)) return true;
  if (!isFunction(node)) return false;
  return node.type !== "ArrowFunctionExpression" || predicateName(node) !== null;
}

function predicateName(node: Node): string | null {
  if (!isFunction(node)) return null;
  const name = predicateCandidateName(node);
  return name && PREDICATE.test(name) ? name : null;
}

/**
 * The predicate around `identifier`, bound to `variable`, that a write to it (or, with `property`, to its property) has a
 * side effect on.
 */
function predicateAffectedBy(identifier: TSESTree.Identifier, variable: VariableT | null, { property }: { property: boolean }): FunctionNode | null {
  for (let current: Node | undefined = identifier.parent; current; current = current.parent) {
    if (predicateName(current) && reachesOutside(variable, current as FunctionNode, { property })) return current as FunctionNode;
  }
  return null;
}

/** Whether writing to `variable` (or, for `property`, to one of its properties) from inside `predicate` reaches outside it. */
function reachesOutside(variable: VariableT | null, predicate: FunctionNode, { property }: { property: boolean }): boolean {
  if (!variable) return true;
  if (!within(asTs(variable.defs[0].name), predicate)) return true;
  return property && variable.defs.some((def) => def.type === "Parameter" && asTs(def.node) === predicate);
}

function within(node: Node, outer: Node): boolean {
  return node.range[0] >= outer.range[0] && node.range[1] <= outer.range[1];
}
