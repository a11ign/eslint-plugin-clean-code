/**
 * What the `react` rules read in a hook call: which React hook a call is, written as `useState(…)` or `React.useState(…)`.
 * They read only the syntax tree, so they work the same under ESLint and Oxlint.
 */
import type { Node, TSESTree } from "../../lib/ast.ts";

/** The hook a call makes, when its callee is `<hook>` or `React.<hook>` and `<hook>` is one of `hooks`; otherwise `null`. */
export function hookCalled(node: Node | null | undefined, hooks: ReadonlySet<string>): string | null {
  if (node?.type !== "CallExpression") return null;
  const name = calleeName(node.callee);
  return name !== null && hooks.has(name) ? name : null;
}

function calleeName(callee: TSESTree.Expression): string | null {
  if (callee.type === "Identifier") return callee.name;
  const isReactMember = callee.type === "MemberExpression" && !callee.computed && callee.object.type === "Identifier" && callee.object.name === "React";
  return isReactMember && callee.property.type === "Identifier" ? callee.property.name : null;
}
