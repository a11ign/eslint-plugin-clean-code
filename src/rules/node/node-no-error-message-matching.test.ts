import { runRuleTests } from "../../testing/run-rule-tests.ts";
import rule from "./node-no-error-message-matching.ts";

const inCatch = (body: string, param = "error") => `try {\n  run();\n} catch (${param}) {\n  ${body}\n}`;
const errors = [{ messageId: "messageMatch", data: { name: "error" } }];

runRuleTests("node-no-error-message-matching", rule, {
  valid: [
    { name: "logging the message", code: inCatch("console.error(error.message);") },
    { name: "putting the message in a new error", code: inCatch("throw new Error(`export failed: ${error.message}`, { cause: error });") },
    { name: "testing the code", code: inCatch('if (error.code === "ENOENT") return;') },
    { name: "testing the class", code: inCatch("if (error instanceof NotFoundError) return;") },
    { name: "matching a message that is not the caught error's", code: inCatch('if (other.message.includes("ENOENT")) return;') },
    { name: "matching outside a catch", code: 'if (error.message.includes("ENOENT")) run();' },
    { name: "a .test() on something that is not a regular expression", code: inCatch("if (checker.test(error.message)) return;") },
    { name: "a .then() callback is not a .catch()", code: 'p.then((error) => error.message.includes("x"));' },
    { name: "a shadowing name inside the catch", code: inCatch('const check = (error) => error.message.includes("x");') },
  ],
  invalid: [
    { name: "message.includes, the ticket's case", code: inCatch('if (error.message.includes("ENOENT")) return;'), output: null, errors: [{ ...errors[0], line: 4 }] },
    { name: "the book's startsWith", code: inCatch("if (e.message.startsWith('Had to fallback')) return;", "e"), output: null, errors: [{ messageId: "messageMatch", data: { name: "e" } }] },
    { name: "endsWith", code: inCatch('error.message.endsWith("x");'), output: null, errors },
    { name: "indexOf", code: inCatch('error.message.indexOf("x");'), output: null, errors },
    { name: "match", code: inCatch("error.message.match(/x/);"), output: null, errors },
    { name: "search", code: inCatch("error.message.search(/x/);"), output: null, errors },
    { name: "===", code: inCatch('if (error.message === "not found") return;'), output: null, errors },
    { name: "!==", code: inCatch('if ("not found" !== error.message) return;'), output: null, errors },
    { name: "==", code: inCatch('if (error.message == "x") return;'), output: null, errors },
    { name: "!=", code: inCatch('if (error.message != "x") return;'), output: null, errors },
    { name: "a regular expression literal's test", code: inCatch("if (/ENOENT/.test(error.message)) return;"), output: null, errors },
    { name: "new RegExp(…).test", code: inCatch('if (new RegExp("ENOENT").test(error.message)) return;'), output: null, errors },
    { name: "in a nested callback inside the catch", code: inCatch('items.forEach(() => error.message.includes("x"));'), output: null, errors },
    { name: "optional chaining", code: inCatch('error.message?.includes("x");'), output: null, errors },
    { name: "a .catch() callback", code: 'load().catch((error) => {\n  if (error.message.includes("ENOENT")) return null;\n  throw error;\n});', output: null, errors: [{ ...errors[0], line: 2 }] },
    { name: "a .catch() function expression", code: 'load().catch(function (error) {\n  return error.message === "x";\n});', output: null, errors },
  ],
});
