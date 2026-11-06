import { defineAiRule } from "../../lib/define-rule.ts";
import { asTs, type TSESTree } from "../../lib/ast.ts";

/** The last names of a callee that make a call a logging call, besides any call on `console`. */
const DEFAULT_LOGGER_NAMES = ["log", "logger", "logError", "warn", "error"];

interface Options {
  allowSwallow?: boolean;
  loggerNames?: string[];
}

/** The names of a callee chain, outermost first: `this.logger.error` gives `this`, `logger`, `error`; `null` for anything else. */
function calleeNames(callee: TSESTree.Node): string[] | null {
  if (callee.type === "Identifier") return [callee.name];
  if (callee.type === "ThisExpression") return ["this"];
  if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return null;
  const object = calleeNames(callee.object);
  return object && [...object, callee.property.name];
}

/** Whether the statement is only a call on `console`, or on a callee whose last name is in `loggerNames`, awaited or not. */
function isLoggingCall(statement: TSESTree.Statement, loggerNames: Set<string>): boolean {
  if (statement.type !== "ExpressionStatement") return false;
  const expression = statement.expression.type === "AwaitExpression" ? statement.expression.argument : statement.expression;
  if (expression.type !== "CallExpression") return false;
  const names = calleeNames(expression.callee);
  if (!names) return false;
  return (names[0] === "console" && names.length === 2) || loggerNames.has(names.at(-1)!);
}

/** Whether the statement is `throw <param>`, rethrowing the error the clause caught. */
function rethrowsParam(statement: TSESTree.Statement | undefined, param: TSESTree.CatchClause["param"]): boolean {
  return statement?.type === "ThrowStatement" && param?.type === "Identifier" && statement.argument.type === "Identifier" && statement.argument.name === param.name;
}

export default defineAiRule<[Options]>({
  name: "ai-no-ceremonial-catch",
  type: "suggestion",
  description: "Don't catch an error only to log it and rethrow it, or only to log it and carry on.",
  pattern: {
    entry: "AI-02",
    name: "ceremonial catch",
    harm: "a catch that only logs adds a duplicate log line on the way up, or, when it does not rethrow, buries the error so the caller carries on as if nothing failed.",
  },
  messages: {
    rethrow: {
      problem: "This catch only logs the error and rethrows it.",
      refactor: "remove the try/catch and let the error reach the boundary that handles and logs it once; if the context is worth adding, throw a new error with the original as its `cause`.",
    },
    swallow: {
      problem: "This catch only logs the error and swallows it, so the caller carries on as if nothing failed.",
      refactor: "handle the error (recover, retry, return a result the caller must check) or let it propagate; if this is a real boundary that must not throw, set `allowSwallow: true`.",
    },
  },
  schema: [
    {
      type: "object",
      properties: {
        allowSwallow: { type: "boolean" },
        loggerNames: { type: "array", items: { type: "string" }, uniqueItems: true },
      },
      additionalProperties: false,
    },
  ],
  defaultOptions: [{ allowSwallow: false, loggerNames: DEFAULT_LOGGER_NAMES }],
  create(context) {
    const options = (context.options[0] as Options | undefined) ?? {};
    const loggerNames = new Set(options.loggerNames ?? DEFAULT_LOGGER_NAMES);
    return {
      CatchClause(node) {
        const clause = asTs<TSESTree.CatchClause>(node);
        const statements = clause.body.body;
        const rethrows = rethrowsParam(statements.at(-1), clause.param);
        const logs = rethrows ? statements.slice(0, -1) : statements;
        if (logs.length === 0 || !logs.every((statement) => isLoggingCall(statement, loggerNames))) return;
        if (!rethrows && options.allowSwallow) return;
        context.report({ node, messageId: rethrows ? "rethrow" : "swallow" });
      },
    };
  },
});
