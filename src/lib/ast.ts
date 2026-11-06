/**
 * The syntax tree as both linters give it: ESTree, with typescript-eslint's TS nodes under ESLint and Oxlint's
 * equivalent ones. Rules read nodes through these types and never through a parser-specific API.
 */
import type { TSESTree } from "@typescript-eslint/types";
import type { Rule, SourceCode, AST } from "eslint";

export type Node = TSESTree.Node;
export type { TSESTree };

/** ESLint's listener types use ESTree's nodes, which have no TS members; rules read them as typescript-eslint's. */
export function asTs<T extends Node = Node>(node: unknown): T {
  return node as T;
}

export type Token = AST.Token;
export type Comment = NonNullable<ReturnType<SourceCode["getAllComments"]>>[number];
export type Fixer = Rule.RuleFixer;
export type Fix = Rule.Fix;

export type FunctionNode = TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression;

export function isFunction(node: Node | null | undefined): node is FunctionNode {
  return node?.type === "FunctionDeclaration" || node?.type === "FunctionExpression" || node?.type === "ArrowFunctionExpression";
}

/** The name a function is known by: its own id, or the variable, property or method it is assigned to. */
export function functionName(node: FunctionNode): string | null {
  if (node.id) return node.id.name;
  const parent = node.parent;
  if (parent?.type === "VariableDeclarator" && parent.id.type === "Identifier") return parent.id.name;
  if ((parent?.type === "MethodDefinition" || parent?.type === "Property" || parent?.type === "PropertyDefinition") && parent.key.type === "Identifier" && !parent.computed) {
    return parent.key.name;
  }
  return null;
}

/** Whether the file is parsed as an ES module (`sourceType: "module"`), where code is strict and top-level bindings are not globals. */
export function isModule(sourceCode: SourceCode): boolean {
  return (sourceCode.ast as { sourceType?: string }).sourceType === "module";
}

/** Whether a body's directive prologue holds `"use strict"`, which makes the code it opens strict-mode code. */
export function hasUseStrictDirective(body: readonly Node[]): boolean {
  return body.some((statement) => statement.type === "ExpressionStatement" && statement.directive === "use strict");
}
