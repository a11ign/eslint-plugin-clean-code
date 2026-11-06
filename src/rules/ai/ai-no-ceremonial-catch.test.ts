import { runRuleTests } from "../../testing/run-rule-tests.ts";
import rule from "./ai-no-ceremonial-catch.ts";

const tryWith = (handler: string, param = "(error)") => `try {\n  run();\n} catch ${param} {\n  ${handler}\n}`;

runRuleTests("ai-no-ceremonial-catch", rule, {
  valid: [
    { name: "log and swallow with allowSwallow", code: tryWith("logger.error(error);"), options: [{ allowSwallow: true }] },
    { name: "a catch that handles the error", code: tryWith("logger.error(error);\nreturn fallback();") },
    { name: "a catch that wraps the error with a cause", code: tryWith("throw new Error(\"export failed\", { cause: error });") },
    { name: "a catch that logs then throws something else", code: tryWith("console.error(error);\nthrow new ExportError(error);") },
    { name: "a catch that only rethrows is left to no-useless-catch", code: tryWith("throw error;") },
    { name: "an empty catch is left to no-empty", code: tryWith("") },
    { name: "a call that is not logging", code: tryWith("metrics.increment(\"failures\");") },
    { name: "a logger method whose last name is not a logging name", code: tryWith("logger.info(error);") },
    { name: "a catch that rethrows a different variable", code: tryWith("console.error(error);\nthrow other;") },
    { name: "loggerNames replaces the defaults", code: tryWith("logger.error(error);"), options: [{ loggerNames: ["report"] }] },
  ],
  invalid: [
    { name: "console.error then rethrow", code: tryWith("console.error(error);\nthrow error;"), output: null, errors: [{ messageId: "rethrow", line: 3 }] },
    { name: "logger.error, swallowed", code: tryWith("logger.error(error);"), output: null, errors: [{ messageId: "swallow" }] },
    { name: "console.log, swallowed", code: tryWith("console.log(\"failed\", error);"), output: null, errors: [{ messageId: "swallow" }] },
    { name: "a catch with no binding that logs", code: tryWith("console.warn(\"failed\");", ""), output: null, errors: [{ messageId: "swallow" }] },
    { name: "several logging calls then rethrow", code: tryWith("console.error(\"export failed\");\nthis.logger.error(error);\nthrow error;"), output: null, errors: [{ messageId: "rethrow" }] },
    { name: "a logError helper, awaited", code: `async function f() {\n${tryWith("await logError(error);")}\n}`, output: null, errors: [{ messageId: "swallow" }] },
    { name: "a call to logger itself", code: tryWith("logger(error);"), output: null, errors: [{ messageId: "swallow" }] },
    { name: "log and rethrow is reported even with allowSwallow", code: tryWith("logger.error(error);\nthrow error;"), options: [{ allowSwallow: true }], output: null, errors: [{ messageId: "rethrow" }] },
    { name: "a name added through loggerNames", code: tryWith("report(error);"), options: [{ loggerNames: ["report"] }], output: null, errors: [{ messageId: "swallow" }] },
  ],
});
