import type { SourceCode } from "eslint";
import { defineNodeRule } from "../../lib/define-rule.ts";
import { asTs, type TSESTree } from "../../lib/ast.ts";
import { enclosingFunctions, functionNamed, isMemberNamed, isMethodCall } from "./node-calls.ts";

const PROCESS = new Set(["process"]);
const NEXT_TICK = new Set(["nextTick"]);

/** The name of the function that `call`, a `process.nextTick(…)`, schedules from inside itself (looked up in `sourceCode`); else `null`. */
function recursiveName(sourceCode: SourceCode, call: TSESTree.CallExpression): string | null {
  const [argument] = call.arguments;
  if (!argument || !isMethodCall(call, PROCESS, NEXT_TICK)) return null;
  if (isMemberNamed(argument, "arguments", "callee")) return "arguments.callee";
  if (argument.type !== "Identifier") return null;
  const scheduled = functionNamed(sourceCode, argument);
  return scheduled && enclosingFunctions(call).includes(scheduled) ? argument.name : null;
}

export default defineNodeRule({
  name: "node-no-recursive-next-tick",
  type: "problem",
  description: "Don't break work up by having a function schedule itself again with `process.nextTick()`.",
  source: {
    entry: "NODE-03",
    book: "Distributed Systems with Node.js",
    section: "§ Event Loop Tips",
    passage: "You should never break up such work using `process.nextTick()` . Doing so will lead to a microtask queue that never empties",
  },
  messages: {
    recursive: {
      problem: "`{{name}}` schedules itself again with `process.nextTick()`, so the queue it runs from never empties and the event loop never moves on.",
      refactor: "continue the next batch with `setImmediate({{name}})`, which lets the event loop handle I/O between batches.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const name = recursiveName(context.sourceCode, asTs<TSESTree.CallExpression>(node));
        if (name !== null) context.report({ node, messageId: "recursive", data: { name } });
      },
    };
  },
});
