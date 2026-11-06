import { defineNodeRule } from "../../lib/define-rule.ts";
import { asTs, isFunction, type FunctionNode, type Node, type TSESTree } from "../../lib/ast.ts";
import { methodName } from "./node-calls.ts";

/** The string methods that test a message's text. */
const MATCHING_METHODS = new Set(["startsWith", "endsWith", "includes", "indexOf", "match", "search"]);
const EQUALITY_OPERATORS = new Set(["===", "!==", "==", "!="]);

/** Whether `node` is `<error>.message`, written without brackets. */
function isMessageOf(node: Node | null | undefined, error: TSESTree.Identifier): node is TSESTree.MemberExpression {
  return node?.type === "MemberExpression" && node.object === error && !node.computed && node.property.type === "Identifier" && node.property.name === "message";
}

/** Whether `node` is a regular expression: a literal, or `new RegExp(…)` / `RegExp(…)`. */
function isRegExp(node: Node): boolean {
  if (node.type === "Literal") return "regex" in node && Boolean(node.regex);
  return (node.type === "NewExpression" || node.type === "CallExpression") && node.callee.type === "Identifier" && node.callee.name === "RegExp";
}

/** Whether `message` (an `error.message`) is tested against text: `message.includes(…)`, `message === …` or `/re/.test(message)`. */
function isTextTest(message: TSESTree.MemberExpression): boolean {
  const parent = message.parent;
  if (parent.type === "BinaryExpression") return EQUALITY_OPERATORS.has(parent.operator);
  if (parent.type === "MemberExpression" && parent.object === message) {
    return parent.parent.type === "CallExpression" && parent.parent.callee === parent && MATCHING_METHODS.has(methodName(parent.parent) ?? "");
  }
  if (parent.type !== "CallExpression" || parent.arguments[0] !== message) return false;
  const { callee } = parent;
  return methodName(parent) === "test" && callee.type === "MemberExpression" && isRegExp(callee.object);
}

/** The error parameter of a `catch` clause, or of a function passed to `.catch(…)`, when it is a plain identifier. */
function errorParameter(owner: TSESTree.CatchClause | FunctionNode): TSESTree.Identifier | null {
  const param = owner.type === "CatchClause" ? owner.param : owner.params[0];
  return param?.type === "Identifier" ? param : null;
}

export default defineNodeRule({
  name: "node-no-error-message-matching",
  type: "suggestion",
  description: "Tell errors apart by their `code` or their class, not by matching the text of their message.",
  source: {
    entry: "NODE-06",
    book: "Distributed Systems with Node.js",
    section: "§ Exceptions, Rejections, and Emitted Errors",
    passage: "your application will need to inspect text meant for human consumption",
  },
  messages: {
    messageMatch: {
      problem: "`{{name}}.message` is tested against text to tell which error this is, and that text is written for people and can change in any release.",
      refactor: "test `{{name}}.code`, or `{{name}} instanceof` a class the library exports; if the library gives neither, ask it for a `code`, and turn this rule off with a directive on this line until it does.",
    },
  },
  create(context) {
    function check(owner: TSESTree.CatchClause | FunctionNode): void {
      const param = errorParameter(owner);
      if (!param) return;
      const variable = context.sourceCode.getDeclaredVariables(owner as never).find((declared) => declared.name === param.name);
      for (const reference of variable?.references ?? []) {
        const identifier = asTs<TSESTree.Identifier>(reference.identifier);
        const message = identifier.parent;
        if (isMessageOf(message, identifier) && isTextTest(message)) context.report({ node: message as never, messageId: "messageMatch", data: { name: param.name } });
      }
    }
    return {
      CatchClause(node) {
        check(asTs(node));
      },
      CallExpression(node) {
        const call = asTs<TSESTree.CallExpression>(node);
        const [callback] = call.arguments;
        if (methodName(call) === "catch" && isFunction(callback)) check(callback);
      },
    };
  },
});
