import type { Rule, SourceCode } from "eslint";
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

/** What the rule learns as it walks the file: the blocking `…Sync()` calls, and the functions passed as event handlers. */
class SyncCalls {
  readonly #handlers = new Set<FunctionNode>();
  readonly #syncCalls: TSESTree.CallExpression[] = [];

  /** Notes `call`: it may be a blocking `…Sync()` call, and it may pass event handlers, which `sourceCode` resolves when named. */
  noteCall(sourceCode: SourceCode, call: TSESTree.CallExpression): void {
    if (SYNC_NAME.test(methodName(call) ?? "")) this.#syncCalls.push(call);
    if (!takesHandlers(call)) return;
    for (const argument of call.arguments) {
      const handler = passedFunction(sourceCode, argument);
      if (handler) this.#handlers.add(handler);
    }
  }

  /** The blocking calls that sit inside an event handler. */
  inHandlers(): TSESTree.CallExpression[] {
    return this.#syncCalls.filter((call) => enclosingFunctions(call).some((fn) => this.#handlers.has(fn)));
  }
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
    const syncCalls = new SyncCalls();
    return {
      CallExpression: (node) => syncCalls.noteCall(context.sourceCode, asTs<TSESTree.CallExpression>(node)),
      "Program:exit": () => syncCalls.inHandlers().forEach((call) => reportBlocking(context, call)),
    };
  },
});

function reportBlocking(context: Rule.RuleContext, call: TSESTree.CallExpression): void {
  context.report({ node: call as never, messageId: "blocking", data: { call: shortQuote(context.sourceCode.getText(call.callee as never)) } });
}
