import { runRuleTests } from "../testing/run-rule-tests.ts";
import rule from "./name-length-matches-scope.ts";

const fiveLines = "function total(items) {\n  let n = 0;\n  for (const item of items) n += item;\n  log(n);\n  return n;\n}";

runRuleTests("name-length-matches-scope", rule, {
  valid: [
    { name: "a parameter of a one-line arrow", code: "export const doubled = [1, 2].map((x) => x * 2);" },
    { name: "the book's loop variable in a short loop", code: "export function sum(tasks) {\n  let total = 0;\n  for (let j = 0; j < 34; j++) {\n    total += (tasks[j] * 4) / 5;\n  }\n  return total;\n}" },
    { name: "a three-line function, at the threshold", code: "export function area(n) {\n  return n * n;\n}" },
    { name: "`catch (e)`, which the book allows", code: "export function run(task) {\n  try {\n    return task();\n  } catch (e) {\n    report(e);\n    return null;\n  }\n}" },
    { name: "`_`, `$` and longer names", code: "const _ = 1;\nconst $ = 2;\nconst id = 3;\nfunction compute(value) {\n  const ok = value > 0;\n  log(ok);\n  return ok;\n}" },
    { name: "type parameters, imports and classes are not variables, parameters or functions", code: 'import * as z from "zod";\nclass A {}\nexport function wrap<T>(value: T): T[] {\n  const list = [value];\n  log(list);\n  return list;\n}' },
    { name: "a larger threshold", code: fiveLines, options: [{ maxLines: 6 }] },
  ],
  invalid: [
    { name: "a local in a five-line function", code: fiveLines, output: null, errors: [{ messageId: "longScope", line: 2, data: { name: "n", lines: "6", max: "3" } }] },
    { name: "a parameter of a long function", code: "export function render(p) {\n  const title = p.title;\n  const body = p.body;\n  return title + body;\n}", output: null, errors: [{ messageId: "longScope" }] },
    { name: "a variable declared at module scope", code: "const x = 1;\nexport const y2 = x;", output: null, errors: [{ messageId: "topLevel" }] },
    { name: "a function declared at module scope", code: "function f() {}\nf();", output: null, errors: [{ messageId: "topLevel" }] },
    { name: "a top-level variable in a script", sourceType: "script", filename: "file.js", code: "var x = 1;", output: null, errors: [{ messageId: "topLevel" }] },
    { name: "an exported variable", code: "export const n = 1;", output: null, errors: [{ messageId: "exported" }] },
    { name: "a variable exported by name", code: "const k = 1;\nexport { k };", output: null, errors: [{ messageId: "exported" }] },
    { name: "a nested function in a long function", code: "export function outer(items) {\n  function g(item) { return item * 2; }\n  const all = items.map(g);\n  return all;\n}", output: null, errors: [{ messageId: "longScope" }] },
    { name: "a catch parameter other than `e` in a long block", code: "export function run(task) {\n  try {\n    return task();\n  } catch (x) {\n    report(x);\n    return null;\n  }\n}", output: null, errors: [{ messageId: "longScope", line: 4 }] },
    { name: "a smaller threshold", code: "export function area(n) {\n  return n * n;\n}", options: [{ maxLines: 2 }], output: null, errors: [{ messageId: "longScope" }] },
  ],
});
