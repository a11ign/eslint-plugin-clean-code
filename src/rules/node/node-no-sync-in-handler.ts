import { defineNodeRule } from "../../lib/define-rule.ts";
import { asTs, type FunctionNode, type TSESTree } from "../../lib/ast.ts";
import { shortQuote } from "../../lib/quote.ts";
import { enclosingFunctions, isMethodCall, methodName, passedFunction } from "./node-calls.ts";

/** The `EventEmitter` methods whose function arguments are event handlers. */
const LISTENER_METHODS = new Set(["on", "once", "addListener", "prependListener", "prependOnceListener"]);
/** `http.createServer(…)`, `https.createServer(…)` and `net.createServer(…)` take a `request` or `connection` handler. */
const SERVER_MODULES = new Set(["http", "https", "net"]);
const CREATE_SERVER = new Set(["createServer"]);
/** A blocking call's name ends in `Sync` with a capital S: `readFileSync`, not `rsync`. */
const SYNC_NAME = /.Sync$/;

/** Whether `call` takes event handlers: an `EventEmitter` listener method, or a server's `createServer`. */
function takesHandlers(call: TSESTree.CallExpression): boolean {
  return LISTENER_METHODS.has(methodName(call) ?? "") || isMethodCall(call, SERVER_MODULES, CREATE_SERVER);
}

export default defineNodeRule({
  name: "node-no-sync-in-handler",
  type: "problem",
  description: "Don't call a blocking `…Sync()` function inside an event handler or a server's request handler.",
  source: {
    entry: "NODE-01",
    book: "JavaScript: The Definitive Guide",
    section: "§ 16.4 Events and EventEmitter",
    passage: "it is important that you keep your event handler functions nonblocking and fast.",
  },
  messages: {
    blocking: {
      problem: "`{{call}}` blocks inside an event handler: no other event is handled until it returns.",
      refactor: "call the asynchronous form (`fs.promises.readFile`, or the callback API) and await it, or do the work once at startup, outside the handler.",
    },
  },
  create(context) {
    const handlers = new Set<FunctionNode>();
    const syncCalls: TSESTree.CallExpression[] = [];
    return {
      CallExpression(node) {
        const call = asTs<TSESTree.CallExpression>(node);
        if (SYNC_NAME.test(methodName(call) ?? "")) syncCalls.push(call);
        if (!takesHandlers(call)) return;
        for (const argument of call.arguments) {
          const handler = passedFunction(context.sourceCode, argument);
          if (handler) handlers.add(handler);
        }
      },
      "Program:exit"() {
        for (const call of syncCalls) {
          if (!enclosingFunctions(call).some((fn) => handlers.has(fn))) continue;
          context.report({ node: call as never, messageId: "blocking", data: { call: shortQuote(context.sourceCode.getText(call.callee as never)) } });
        }
      },
    };
  },
});
