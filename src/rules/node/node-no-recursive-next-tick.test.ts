import { runRuleTests } from "../../testing/run-rule-tests.ts";
import rule from "./node-no-recursive-next-tick.ts";

runRuleTests("node-no-recursive-next-tick", rule, {
  valid: [
    { name: "process.nextTick of a different function", code: "function drainQueue() {\n  process.nextTick(flush);\n}" },
    { name: "setImmediate inside the function, the book's remedy", code: "function drainQueue() {\n  setImmediate(drainQueue);\n}" },
    { name: "process.nextTick of the function from outside it", code: "function drainQueue() {}\nprocess.nextTick(drainQueue);" },
    { name: "a nested function of the same name shadows the outer one", code: "function drainQueue() {\n  function inner() {\n    const drainQueue = () => 1;\n    process.nextTick(drainQueue);\n  }\n}" },
    { name: "a let bound to a function is not a const function", code: "let drainQueue = () => {\n  process.nextTick(drainQueue);\n};" },
    { name: "nextTick on another object", code: "function drainQueue() {\n  scheduler.nextTick(drainQueue);\n}" },
  ],
  invalid: [
    {
      name: "a function declaration that schedules itself",
      code: "function drainQueue() {\n  process.nextTick(drainQueue);\n}",
      output: null,
      errors: [{ messageId: "recursive", data: { name: "drainQueue" }, line: 2 }],
    },
    { name: "a named function expression", code: "queue.start(function drain() {\n  process.nextTick(drain);\n});", output: null, errors: [{ messageId: "recursive", data: { name: "drain" } }] },
    { name: "a const arrow function", code: "const drain = () => {\n  process.nextTick(drain);\n};", output: null, errors: [{ messageId: "recursive", data: { name: "drain" } }] },
    { name: "inside a callback within the function", code: "function drain() {\n  items.forEach(() => process.nextTick(drain));\n}", output: null, errors: [{ messageId: "recursive" }] },
    { name: "with further arguments", code: "function drain(batch) {\n  process.nextTick(drain, batch + 1);\n}", output: null, errors: [{ messageId: "recursive" }] },
    { name: "process.nextTick(arguments.callee)", code: "function drain() {\n  process.nextTick(arguments.callee);\n}", sourceType: "script", filename: "file.js", output: null, errors: [{ messageId: "recursive", data: { name: "arguments.callee" } }] },
  ],
});
