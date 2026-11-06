import { runRuleTests } from "../testing/run-rule-tests.ts";
import rule from "./no-mutable-static-state.ts";

runRuleTests("no-mutable-static-state", rule, {
  valid: [
    {
      name: "the book's remedy: instance fields shared by instance methods",
      code: "class Report { lines: string[] = []; run() { this.lines = []; this.addHeader(); } addHeader() { this.lines.push('h'); } }",
    },
    {
      name: "a static constant that is only read",
      code: "class A { static readonly MAX = 3; f() { return A.MAX; } }",
    },
    {
      name: "a static field set once, in its initialiser or a static block",
      code: "class A { static cache = new Map(); static { A.cache = new Map(); } }",
    },
    {
      name: "an instance field with the same name as a static one",
      code: "class A { static count = 0; count = 0; inc() { this.count++; } }",
    },
    {
      name: "a function expression binds its own `this`",
      code: "class A { static n = 0; static f() { return function () { this.n = 1; }; } }",
    },
    {
      name: "a static field of another class",
      code: "class A { static n = 0; } class B { f() { A.n = 1; } }",
    },
    {
      name: "mutating the object a static field holds is not an assignment to the field",
      code: "class A { static items = []; static add(x) { A.items.push(x); } }",
    },
  ],
  invalid: [
    {
      name: "static fields shared by extracted static methods, through the class name",
      code: [
        "class PrimePrinter {",
        "  static numberOfPrimes = 0;",
        "  static primes: number[] = [];",
        "  static main() { PrimePrinter.numberOfPrimes = 1000; PrimePrinter.primes = []; }",
        "}",
      ].join("\n"),
      errors: [
        { messageId: "mutableStatic", line: 2, data: { field: "numberOfPrimes", className: "PrimePrinter", method: "main" } },
        { messageId: "mutableStatic", line: 3, data: { field: "primes", className: "PrimePrinter", method: "main" } },
      ],
      output: null,
    },
    {
      name: "`this` in a static method is the class, and `++` is an assignment",
      code: "class Counter { static count = 0; static next() { return ++this.count; } }",
      errors: [{ messageId: "mutableStatic", data: { field: "count", className: "Counter", method: "next" } }],
      output: null,
    },
    {
      name: "an instance method that writes a static field, inside an arrow function",
      code: "class A { static total = 0; add(xs: number[]) { xs.forEach((x) => { A.total += x; }); } }",
      errors: [{ messageId: "mutableStatic", data: { field: "total", className: "A", method: "add" } }],
      output: null,
    },
    {
      name: "a private static field, a class expression, and a field holding an arrow function",
      code: "const Cache = class { static #hits = 0; static record = () => { Cache.#hits = Cache.#hits + 1; }; };",
      errors: [{ messageId: "mutableStatic", data: { field: "#hits", className: "Cache", method: "record" } }],
      output: null,
    },
    {
      name: "each field is reported once",
      code: "class A { static n = 0; static f() { A.n = 1; } static g() { A.n = 2; } }",
      errors: [{ messageId: "mutableStatic", data: { field: "n", className: "A", method: "f" } }],
      output: null,
    },
  ],
});
