import { runRuleTests } from "../testing/run-rule-tests.ts";
import rule from "./loop-variable-in-loop.ts";

const report = [{ messageId: "declaredBeforeLoop" }];
const lengths = ["f(0)", "f(1)", "f(4)", "f(-1)"];

runRuleTests("loop-variable-in-loop", rule, {
  valid: [
    { name: "declared in the loop statement", code: "for (let i = 0; i < 3; i++) { use(i); }" },
    { name: "read after the loop", code: "let i;\nfor (i = 0; i < 3; i++) { use(i); }\nuse(i);" },
    { name: "the loop's init does not assign it", code: "let i = 0;\nfor (; i < 3; i++) { use(i); }" },
    { name: "a `while` loop", code: "let i;\nwhile (i < 3) { i = next(); }" },
    { name: "a `const` before the loop", code: "const n = 3;\nfor (let j = 0; j < n; j++) { use(j); }" },
    { name: "a `var`", code: "var i;\nfor (i = 0; i < 3; i++) { use(i); }" },
  ],
  invalid: [
    {
      name: "the catalog's example, on one line",
      code: "function f(n) { const out = []; let i; for (i = 0; i < n; i++) { out.push(i * 2); } return out; }",
      output: "function f(n) { const out = []; for (let i = 0; i < n; i++) { out.push(i * 2); } return out; }",
      errors: [{ messageId: "declaredBeforeLoop", data: { name: "i" } }],
      behaviour: lengths,
    },
    {
      name: "the declaration on its own line, with a type",
      code: "export function f(n: number): number {\n  let total = 0;\n  let i: number;\n  for (i = n; i > 0; i--) {\n    total += i;\n  }\n  return total;\n}\n",
      output: "export function f(n: number): number {\n  let total = 0;\n  for (let i: number = n; i > 0; i--) {\n    total += i;\n  }\n  return total;\n}\n",
      errors: report,
      behaviour: lengths,
    },
    {
      name: "regression row 3: a `;[1, 2].forEach(g)` line after the loop keeps its `;`",
      code: "function f(n) {\n  const seen = []\n  const g = (x) => seen.push(x)\n  let i\n  for (i = 0; i < n; i++) g(i)\n  ;[1, 2].forEach(g)\n  return seen\n}\n",
      output: "function f(n) {\n  const seen = []\n  const g = (x) => seen.push(x)\n  for (let i = 0; i < n; i++) g(i)\n  ;[1, 2].forEach(g)\n  return seen\n}\n",
      errors: report,
      behaviour: lengths,
    },
    {
      name: "regression row 3: a `;[1, 2].forEach(g)` line between the declaration and the loop: reported, no fix",
      code: "function f(n) {\n  const seen = []\n  const g = (x) => seen.push(x)\n  let i\n  ;[1, 2].forEach(g)\n  for (i = 0; i < n; i++) g(i)\n  return seen\n}\n",
      output: null,
      errors: report,
    },
    {
      name: "a reference in the loop body and its condition",
      code: "function f(n) {\n  const out = [];\n  let i;\n  for (i = 1; i <= n; i *= 2) {\n    if (i > 2) out.push(i);\n  }\n  return out;\n}\n",
      output: "function f(n) {\n  const out = [];\n  for (let i = 1; i <= n; i *= 2) {\n    if (i > 2) out.push(i);\n  }\n  return out;\n}\n",
      errors: report,
      behaviour: [...lengths, "f(40)"],
    },
    {
      name: "no fix when a reference is outside the `for` statement",
      code: "let i;\nfor (i = 0; i < 3; i++) { use(i); }\ni = 9;\n",
      output: null,
      errors: report,
    },
    {
      name: "no fix when a nested function sees the variable",
      code: "const fs = [];\nlet i;\nfor (i = 0; i < 3; i++) { fs.push(() => i); }\n",
      output: null,
      errors: report,
    },
    {
      name: "no fix when a nested class sees the variable",
      code: "const cs = [];\nlet i;\nfor (i = 0; i < 3; i++) { cs.push(class { n = i; }); }\n",
      output: null,
      errors: report,
    },
    {
      name: "no fix when the declaration declares other variables",
      code: "let i, j = 0;\nfor (i = 0; i < 3; i++) { j += i; }\nuse(j);\n",
      output: null,
      errors: [{ messageId: "declaredBeforeLoop", data: { name: "i" } }],
    },
    {
      name: "no fix when the declaration has an initializer",
      code: "let i = 0;\nfor (i = 0; i < 3; i++) { use(i); }\n",
      output: null,
      errors: report,
    },
    {
      name: "no fix when the declaration is not directly before the loop",
      code: "let i;\nuse(0);\nfor (i = 0; i < 3; i++) { use(i); }\n",
      output: null,
      errors: report,
    },
    {
      name: "no fix when the loop's init assigns more than the variable",
      code: "let j = 0;\nlet i;\nfor (i = 0, j = 1; i < 3; i++) { use(i); }\nuse(j);\n",
      output: null,
      errors: report,
    },
    {
      name: "no fix when the value assigned reads the variable, which would be in its temporal dead zone",
      code: "let i;\nfor (i = i ?? 0; i < 3; i++) { use(i); }\n",
      output: null,
      errors: report,
    },
  ],
});
