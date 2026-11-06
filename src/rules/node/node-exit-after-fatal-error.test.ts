import { runRuleTests } from "../../testing/run-rule-tests.ts";
import rule from "./node-exit-after-fatal-error.ts";

const errors = [{ messageId: "keepsRunning" }];

runRuleTests("node-exit-after-fatal-error", rule, {
  valid: [
    { name: "logs, then exits", code: 'process.on("uncaughtException", (error) => {\n  console.error(error);\n  process.exit(1);\n});' },
    { name: "an arrow that only exits", code: 'process.once("unhandledRejection", () => process.exit(1));' },
    { name: "aborts", code: 'process.on("uncaughtException", () => {\n  process.abort();\n});' },
    { name: "sets process.exitCode", code: 'process.on("unhandledRejection", (reason) => {\n  logger.error(reason);\n  process.exitCode = 1;\n});' },
    { name: "rethrows", code: 'process.on("unhandledRejection", (reason) => {\n  throw reason;\n});' },
    { name: "exits once the server has closed", code: 'process.on("uncaughtException", (error) => {\n  logger.error(error);\n  server.close(() => process.exit(1));\n});' },
    { name: "a handler for another event", code: 'process.on("SIGINT", () => {\n  console.log("bye");\n});' },
    { name: "an uncaughtException listener on another object", code: 'emitter.on("uncaughtException", (error) => {\n  console.error(error);\n});' },
    { name: "a capture callback that exits", code: "process.setUncaughtExceptionCaptureCallback((error) => {\n  console.error(error);\n  process.exit(1);\n});" },
    { name: "a named handler that exits", code: 'function onFatal(error) {\n  console.error(error);\n  process.exit(1);\n}\nprocess.on("uncaughtException", onFatal);' },
  ],
  invalid: [
    { name: "an uncaughtException handler that only logs", code: 'process.on("uncaughtException", (error) => {\n  console.error(error);\n});', output: null, errors: [{ messageId: "keepsRunning", line: 1, column: 33 }] },
    { name: "an unhandledRejection handler that only logs", code: 'process.once("unhandledRejection", function (reason) {\n  logger.error(reason);\n});', output: null, errors },
    { name: "a capture callback that only logs", code: "process.setUncaughtExceptionCaptureCallback((error) => {\n  console.error(error);\n});", output: null, errors },
    { name: "a named handler that only logs", code: 'function onFatal(error) {\n  console.error(error);\n}\nprocess.on("uncaughtException", onFatal);', output: null, errors: [{ messageId: "keepsRunning", line: 4 }] },
    { name: "an exit in another function does not count", code: 'function stop() {\n  process.exit(1);\n}\nprocess.on("uncaughtException", (error) => {\n  console.error(error);\n});', output: null, errors },
    { name: "assigning something other than process.exitCode", code: 'process.on("uncaughtException", (error) => {\n  state.failed = true;\n});', output: null, errors },
  ],
});
