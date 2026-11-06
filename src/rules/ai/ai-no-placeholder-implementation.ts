import type { SourceCode } from "eslint";
import { defineAiRule } from "../../lib/define-rule.ts";
import { asTs, type FunctionNode, type TSESTree } from "../../lib/ast.ts";

/** What a placeholder's error message or marker comment says. */
const STUB_MARKER = /not (yet )?implemented|todo|implement (me|this)|stub/i;

/** A class named for being a stand-in, whose stub bodies are the point. */
const STAND_IN_CLASS = /(Stub|Fake|Mock)$/;

/** The text of a string literal, or of a template literal with no `${…}` parts; `null` for anything else. */
function staticText(node: TSESTree.Node | undefined): string | null {
  if (node?.type === "Literal" && typeof node.value === "string") return node.value;
  if (node?.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis[0].value.cooked ?? null;
  return null;
}

/** `throw new SomethingError("Not implemented")`, or the same with `Error` called without `new`. */
function isPlaceholderThrow(statement: TSESTree.Statement): boolean {
  if (statement.type !== "ThrowStatement") return false;
  const thrown = statement.argument;
  if (thrown.type !== "NewExpression" && thrown.type !== "CallExpression") return false;
  if (thrown.callee.type !== "Identifier" || !thrown.callee.name.endsWith("Error")) return false;
  const message = staticText(thrown.arguments[0]);
  return message !== null && STUB_MARKER.test(message);
}

/** Whether `return` gives one of the stub values: `null`, `undefined`, `{}`, `[]` or `""`. */
function returnsStubValue(statement: TSESTree.Statement): boolean {
  if (statement.type !== "ReturnStatement" || !statement.argument) return false;
  const value = statement.argument;
  if (value.type === "Literal") return value.value === null || value.value === "";
  if (value.type === "Identifier") return value.name === "undefined";
  if (value.type === "ObjectExpression") return value.properties.length === 0;
  if (value.type === "ArrayExpression") return value.elements.length === 0;
  return staticText(value) === "";
}

/** Whether a comment inside the body says it is a stub. */
function hasStubMarker(sourceCode: SourceCode, body: TSESTree.BlockStatement): boolean {
  return sourceCode.getAllComments().some((comment) => comment.range![0] > body.range[0] && comment.range![1] < body.range[1] && STUB_MARKER.test(comment.value));
}

/** The nearest class the function is a member of, or `null`. */
function enclosingClass(node: TSESTree.Node): TSESTree.ClassDeclaration | TSESTree.ClassExpression | null {
  for (let current = node.parent; current; current = current.parent) {
    if (current.type === "ClassDeclaration" || current.type === "ClassExpression") return current;
  }
  return null;
}

function isInStandInClass(node: TSESTree.Node): boolean {
  const name = enclosingClass(node)?.id?.name;
  return name !== undefined && STAND_IN_CLASS.test(name);
}

export default defineAiRule({
  name: "ai-no-placeholder-implementation",
  type: "problem",
  description: "Don't ship a function whose body is only a placeholder: `throw new Error(\"Not implemented\")` or a stub return.",
  pattern: {
    entry: "AI-03",
    name: "stub bodies",
    harm: "a stub compiles, passes review at a glance and fails only when it is called, often in production.",
  },
  messages: {
    placeholder: {
      problem: "This function's body is only a placeholder.",
      refactor: "implement it, or remove it and its callers until it is needed; a stand-in for tests belongs in a test file or a class named `…Stub`, `…Fake` or `…Mock`.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    function check(node: unknown) {
      const fn = asTs<FunctionNode>(node);
      if (fn.body?.type !== "BlockStatement" || fn.body.body.length !== 1) return;
      const [statement] = fn.body.body;
      const placeholder = isPlaceholderThrow(statement) || (returnsStubValue(statement) && hasStubMarker(sourceCode, fn.body));
      if (placeholder && !isInStandInClass(fn)) context.report({ node: node as never, messageId: "placeholder" });
    }
    return { FunctionDeclaration: check, FunctionExpression: check, ArrowFunctionExpression: check };
  },
});
