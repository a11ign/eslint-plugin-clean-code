import type { SourceCode } from "eslint";
import { defineNodeRule } from "../../lib/define-rule.ts";
import { asTs, type FunctionNode, type Node, type TSESTree } from "../../lib/ast.ts";
import { enclosingFunctions, isMemberNamed, isMethodCall, passedFunction } from "./node-calls.ts";

const PROCESS = new Set(["process"]);
const LISTENER_METHODS = new Set(["on", "once"]);
const CAPTURE_CALLBACK = new Set(["setUncaughtExceptionCaptureCallback"]);
const ENDING_METHODS = new Set(["exit", "abort"]);
const FATAL_EVENTS = new Set(["uncaughtException", "unhandledRejection"]);

/** The fatal-error handler a call registers on `process`, or `null` when it registers none. */
function fatalErrorHandler(call: TSESTree.CallExpression): Node | null {
  if (isMethodCall(call, PROCESS, CAPTURE_CALLBACK)) return call.arguments[0] ?? null;
  if (!isMethodCall(call, PROCESS, LISTENER_METHODS)) return null;
  const [event, handler] = call.arguments;
  const isFatal = event?.type === "Literal" && typeof event.value === "string" && FATAL_EVENTS.has(event.value);
  return isFatal ? (handler ?? null) : null;
}

/** Whether `node` ends the process: `process.exit(…)`, `process.abort()`, an assignment to `process.exitCode`, or a `throw`. */
function endsProcess(node: Node): boolean {
  if (node.type === "ThrowStatement") return true;
  if (node.type === "AssignmentExpression") return isMemberNamed(node.left, "process", "exitCode");
  return node.type === "CallExpression" && isMethodCall(node, PROCESS, ENDING_METHODS);
}

/** What the rule learns as it walks the file: the fatal-error handlers registered on `process`, and the functions that end it. */
class FatalErrorHandlers {
  /** Each handler function, mapped to the argument that passed it, which is where a report goes. */
  readonly #handlers = new Map<FunctionNode, Node>();
  readonly #ending = new Set<FunctionNode>();

  /** Notes a call: it may end the process, and it may register a handler for a fatal error. */
  noteCall(sourceCode: SourceCode, call: TSESTree.CallExpression): void {
    this.noteEnding(call);
    const argument = fatalErrorHandler(call);
    const handler = argument && passedFunction(sourceCode, argument);
    if (handler && argument) this.#handlers.set(handler, argument);
  }

  /** Notes every function `node` sits in as ending the process, when `node` ends it. */
  noteEnding(node: Node): void {
    if (endsProcess(node)) for (const fn of enclosingFunctions(node)) this.#ending.add(fn);
  }

  /** The arguments that passed a handler which never ends the process. */
  keepingRunning(): Node[] {
    return [...this.#handlers].filter(([handler]) => !this.#ending.has(handler)).map(([, argument]) => argument);
  }
}

export default defineNodeRule({
  name: "node-exit-after-fatal-error",
  type: "problem",
  description: "A handler for an uncaught exception or an unhandled rejection ends the process; it does not log the error and carry on.",
  source: {
    entry: "NODE-04",
    book: "Distributed Systems with Node.js",
    section: "§ Exceptions, Rejections, and Emitted Errors",
    passage: "it's important to not allow the process to continue running since it is likely in an invalid state.",
  },
  messages: {
    keepsRunning: {
      problem: "This handler for a fatal error never ends the process, so it keeps running in a state nothing expected.",
      refactor: "after logging, end the process: call `process.exit(1)`, set `process.exitCode = 1` once servers are closed, or rethrow the error.",
    },
  },
  create(context) {
    const handlers = new FatalErrorHandlers();
    const noteEnding = (node: unknown) => handlers.noteEnding(asTs(node));
    return {
      CallExpression: (node) => handlers.noteCall(context.sourceCode, asTs<TSESTree.CallExpression>(node)),
      AssignmentExpression: noteEnding,
      ThrowStatement: noteEnding,
      "Program:exit": () => handlers.keepingRunning().forEach((argument) => context.report({ node: argument as never, messageId: "keepsRunning" })),
    };
  },
});
