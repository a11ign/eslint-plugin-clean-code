import { defineRule } from "../lib/define-rule.ts";
import { asTs, isFunction, type Node, type TSESTree } from "../lib/ast.ts";

type Statement = TSESTree.Statement;

/** Statements that may come before the `try`: the book's "some variable declarations", and TypeScript type declarations, which do nothing at run time. */
function isDeclarationOnly(statement: Statement): boolean {
  return statement.type === "VariableDeclaration" || statement.type === "TSTypeAliasDeclaration" || statement.type === "TSInterfaceDeclaration";
}

/** A directive prologue entry (`"use strict"`) or an empty statement, which are not code the function runs. */
function isNotCode(statement: Statement): boolean {
  return statement.type === "EmptyStatement" || (statement.type === "ExpressionStatement" && typeof statement.directive === "string");
}

/** Whether a `try` statement sits inside a `catch` clause of the same function. */
function isInsideCatch(node: TSESTree.TryStatement): boolean {
  for (let current: Node | undefined = node.parent; current && !isFunction(current); current = current.parent) {
    if (current.type === "CatchClause") return true;
  }
  return false;
}

export default defineRule({
  name: "error-handling-is-one-thing",
  type: "suggestion",
  description: "A function that handles errors does nothing else: its `try` comes first and nothing follows the `catch` or `finally`.",
  book: {
    entry: "FH-07",
    chapter: "8 Function Heuristics § Error Handling Is One Thing",
    passage: "if the keyword `try` exists in a function, it should be the very first word in the function (after, perhaps, some variable declarations) and that there should be nothing after the `catch` / `finally` blocks.",
  },
  messages: {
    beforeTry: {
      problem: "This statement runs before the function's `try`; only variable declarations may come first.",
      refactor: "extract the `try` statement into a function of its own, so that one function handles the error and the other does the work.",
    },
    afterTry: {
      problem: "This statement runs after the function's `try` statement; nothing should follow the `catch` or `finally` block.",
      refactor: "extract the `try` statement into a function of its own, so that one function handles the error and the other does the work.",
    },
    tryInCatch: {
      problem: "This `try` is nested inside a `catch` clause.",
      refactor: "extract the error handling of the `catch` into a function of its own, so each function handles one error.",
    },
  },
  create(context) {
    function checkBody(body: TSESTree.BlockStatement): void {
      const statements = body.body.filter((statement) => !isNotCode(statement));
      const first = statements.findIndex((statement) => statement.type === "TryStatement");
      if (first === -1) return;
      statements.forEach((statement, index) => {
        if (index < first && !isDeclarationOnly(statement)) context.report({ node: statement as never, messageId: "beforeTry" });
        else if (index > first) context.report({ node: statement as never, messageId: "afterTry" });
      });
    }
    function checkFunction(node: unknown): void {
      const fn = asTs<TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression>(node);
      if (fn.body?.type === "BlockStatement") checkBody(fn.body);
    }
    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
      TryStatement(node) {
        const statement = asTs<TSESTree.TryStatement>(node);
        if (isInsideCatch(statement)) context.report({ node, messageId: "tryInCatch" });
      },
    };
  },
});
