import { runRuleTests, type InvalidCase } from "../testing/run-rule-tests.ts";
import rule from "./no-pure-delegator.ts";

/**
 * Every invalid case is an ES module with an `export`, which the fix requires (`isModule`), so that each no-fix case
 * tests its own condition. The cases that test the module condition itself are left as they are.
 */
function inModule(testCase: InvalidCase): InvalidCase {
  if (testCase.sourceType === "script" || testCase.name?.includes("no `import` or `export`")) return testCase;
  return { ...testCase, code: `${testCase.code}\nexport {};`, output: testCase.output === null ? null : `${testCase.output}\nexport {};` };
}

const g = "function g(a, b) { return [a, b, arguments.length]; }\n";

runRuleTests("no-pure-delegator", rule, {
  valid: [
    { name: "the body does more than delegate", code: `${g}function f(a, b) { return g(a, b).length; }` },
    { name: "the parameters change order", code: `${g}function f(a, b) { return g(b, a); }` },
    { name: "an argument is not a parameter", code: `${g}function f(a) { return g(a, 1); }` },
    { name: "a parameter is left out", code: `${g}function f(a, b) { return g(a); }` },
    { name: "two statements", code: `${g}function f(a) { log(a); return g(a); }` },
    { name: "an exported delegator lets the extracted function move to a new module (the book's footnote)", code: `${g}export function f(a, b) { return g(a, b); }` },
    { name: "exported by name", code: `${g}function f(a, b) { return g(a, b); }\nexport { f };` },
    { name: "exported as default", code: `${g}function f(a, b) { return g(a, b); }\nexport default f;` },
    { name: "a method forwards a request (Tell the Other Guy)", code: `${g}class A { f(a, b) { return g(a, b); } }` },
    { name: "an object method", code: `${g}const o = { f(a, b) { return g(a, b); } };` },
    { name: "a `const` arrow function is not a function declaration", code: `${g}const f = (a, b) => g(a, b);` },
    { name: "the callee is not declared in this file", code: "function f(url) { return fetch(url); }" },
    { name: "the callee is imported", code: "import { g } from './g';\nfunction f(a) { return g(a); }" },
    { name: "the callee is a parameter", code: "function f(g, a) { return g(a); }" },
    { name: "the callee is a member", code: "function f(a) { return api.g(a); }" },
    { name: "a call through `this` passes more than the parameters", code: `${g}function f(a) { return g.call(this, a); }` },
    { name: "an optional call", code: `${g}function f(a) { return g?.(a); }` },
    { name: "recursion is not delegation", code: "function f(a) { return f(a); }" },
  ],
  invalid: (
    [
    {
      name: "a delegator that returns the call",
      code: `${g}function f(a, b) { return g(a, b); }\nconst run = (x) => [f(x, x + 1), f(-x, 'b')];`,
      output: `${g}const run = (x) => [g(x, x + 1), g(-x, 'b')];`,
      errors: [{ messageId: "pureDelegator", data: { name: "f", target: "g" } }],
      behaviour: "[0, 1, -2.5, NaN, 'a', null].map((x) => run(x))",
    },
    {
      name: "a delegator without `return`, called as a statement",
      code: "const log = [];\nfunction record(m) { log.push(m); }\nfunction note(m) { record(m); }\nconst run = (x) => { note(x); note?.(x * 2); return log; };",
      output: "const log = [];\nfunction record(m) { log.push(m); }\nconst run = (x) => { record(x); record?.(x * 2); return log; };",
      errors: [{ messageId: "pureDelegator", data: { name: "note", target: "record" } }],
      behaviour: ["[run(1), run(2), run('x')]", "run(undefined).length"],
    },
    {
      name: "its doc comment goes with it, and a call before the declaration is replaced too",
      code: `const first = f(1, 2);\n${g}/** Delegates to g. */\nfunction f(a, b) {\n  return g(a, b);\n}\nconst second = f(3, 4);`,
      output: `const first = g(1, 2);\n${g}const second = g(3, 4);`,
      errors: 1,
      behaviour: "[first, second]",
    },
    {
      name: "in TypeScript, inside another function",
      code: "function outer(n: number): number[] {\n  function g(a: number): number { return a * 2; }\n  function f(a: number): number { return g(a); }\n  return [f(n), f(n + 1)];\n}",
      output: "function outer(n: number): number[] {\n  function g(a: number): number { return a * 2; }\n  return [g(n), g(n + 1)];\n}",
      errors: 1,
      behaviour: "[0, 1, -3, 0.5].map((n) => outer(n))",
    },
    {
      name: "regression: in code without semicolons, the `;` that starts the line after the delegator survives",
      code: "const out = []\nconst f = (v) => out.push(twice(v))\nfunction twice(v) { return double(v) }\n;[1, 2].forEach(f)\nfunction double(v) { return v * 2 }",
      output: "const out = []\nconst f = (v) => out.push(double(v))\n;[1, 2].forEach(f)\nfunction double(v) { return v * 2 }",
      errors: [{ messageId: "pureDelegator", data: { name: "twice", target: "double" } }],
      behaviour: "out",
    },
    {
      name: "in code without semicolons, a `;` is added when the next line would continue the previous statement",
      code: "const out = []\nconst f = (v) => out.push(twice(v))\nfunction twice(v) { return double(v) }\n[3, -4].forEach(f)\nfunction double(v) { return v * 2 }",
      output: "const out = []\nconst f = (v) => out.push(double(v))\n;[3, -4].forEach(f)\nfunction double(v) { return v * 2 }",
      errors: 1,
      behaviour: "out",
    },
    {
      name: "an unused delegator is removed",
      code: `${g}function f(a, b) { return g(a, b); }\nconst v = g(1, 2);`,
      output: `${g}const v = g(1, 2);`,
      errors: 1,
      behaviour: "v",
    },
    { name: "no fix: no `import` or `export`, so the file may be a classic script", code: `${g}function f(a, b) { return g(a, b); }\nf(1, 2);`, errors: 1, output: null },
    {
      name: "no fix: an arrow argument typed by the delegator's annotation would lose its type",
      code: "const results: string[] = [];\nfunction runAll(callback: Function) { results.push(String(callback(2))); }\nfunction runEach(callback: (value: number) => string) { return runAll(callback); }\nrunEach((value) => value.toFixed(1));",
      errors: 1,
      output: null,
    },
    { name: "no fix: an object literal argument typed by the delegator's annotation", code: "function g(o: object) { return o; }\nfunction f(o: { kind: 'a' | 'b' }) { return g(o); }\nf({ kind: 'a' });", errors: 1, output: null },
    { name: "no fix: an array literal argument typed by the delegator's annotation", code: "function g(o: unknown) { return o; }\nfunction f(o: [number, string]) { return g(o); }\nf([1, 'a']);", errors: 1, output: null },
    {
      name: "no fix: another declaration of the delegator in the scope",
      code: "function outer() {\n  function g(a) { return a; }\n  function f(a) { return g(a); }\n  function f(a) { return -a; }\n  return f(1);\n}",
      filename: "file.js",
      errors: 1,
      output: null,
    },
    { name: "no fix: a direct `eval` in the file can call the delegator", code: `${g}function f(a, b) { return g(a, b); }\nf(1, 2);\neval('f(1, 2)');`, errors: 1, output: null },
    { name: "no fix: `async`, since the result would no longer be a promise", code: `${g}async function f(a) { return g(a); }\nf(1);`, errors: 1, output: null },
    { name: "no fix: a generator", code: `${g}function* f(a) { return g(a); }\nf(1);`, errors: 1, output: null },
    { name: "no fix: a default value", code: `${g}function f(a = 1) { return g(a); }\nf();`, errors: 1, output: null },
    { name: "no fix: a rest parameter", code: `${g}function f(...a) { return g(...a); }\nf(1, 2);`, errors: 1, output: null },
    { name: "no fix: a call with fewer arguments", code: `${g}function f(a, b) { return g(a, b); }\nf(1);`, errors: 1, output: null },
    { name: "no fix: a call with more arguments", code: `${g}function f(a, b) { return g(a, b); }\nf(1, 2, 3);`, errors: 1, output: null },
    { name: "no fix: a spread argument", code: `${g}function f(a, b) { return g(a, b); }\nf(...[1, 2]);`, errors: 1, output: null },
    { name: "no fix: `new`", code: `${g}function f(a, b) { return g(a, b); }\nnew f(1, 2);`, errors: 1, output: null },
    { name: "no fix: a tagged template", code: `${g}function f(a, b) { return g(a, b); }\n` + "f`x${1}`;", errors: 1, output: null },
    { name: "no fix: passed as a value", code: `${g}function f(a, b) { return g(a, b); }\n[1].map(f);`, errors: 1, output: null },
    {
      name: "no fix: a parameter named `arguments` (sloppy mode)",
      code: "function outer() {\n  function g(a) { return a; }\n  function f(arguments) { return g(arguments); }\n  return f(1);\n}",
      sourceType: "script",
      errors: 1,
      output: null,
    },
    { name: "no fix: the result of a delegator without `return` is used", code: "function g(a) { console.log(a); }\nfunction f(a) { g(a); }\nconst v = f(1);", errors: 1, output: null },
    {
      name: "no fix: the callee is shadowed at a call site",
      code: `${g}function f(a, b) { return g(a, b); }\nfunction h() { const g = 2; return f(g, 3); }`,
      errors: 1,
      output: null,
    },
    { name: "no fix: the callee is a `const`, which is not hoisted", code: "const g = (a) => a;\nfunction f(a) { return g(a); }\nf(1);", errors: 1, output: null },
    { name: "no fix: the callee is reassigned", code: `${g}function f(a, b) { return g(a, b); }\nf(1, 2);\ng = () => 0;`, errors: 1, output: null },
    {
      name: "no fix: an overloaded delegator",
      code: "function g(a: unknown) { return a; }\nfunction f(a: string): string;\nfunction f(a: unknown) { return g(a); }\nf('x');",
      errors: 1,
      output: null,
    },
    { name: "no fix: type arguments", code: "function g<T>(a: T) { return a; }\nfunction f<T>(a: T) { return g<T>(a); }\nf(1);", errors: 1, output: null },
    {
      name: "no fix: a global function in a script can be called from other scripts",
      code: `${g}function f(a, b) { return g(a, b); }\nf(1, 2);`,
      sourceType: "script",
      errors: 1,
      output: null,
    },
    {
      name: "no fix: a directive comment would be removed",
      code: `${g}function f(a, b) { // eslint-disable-line no-console\n  return g(a, b);\n}\nf(1, 2);`,
      errors: 1,
      output: null,
    },
    ] satisfies InvalidCase[]
  ).map(inModule),
});
