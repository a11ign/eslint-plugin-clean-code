import { runRuleTests } from "../testing/run-rule-tests.ts";
import rule from "./no-hybrid-class.ts";

runRuleTests("no-hybrid-class", rule, {
  valid: [
    {
      name: "a data structure: public fields, no behaviour",
      code: "class Point { x = 0; y = 0; }",
    },
    {
      name: "an object: private fields, public behaviour",
      code: "class Account { #balance = 0; private owner = ''; deposit(n: number) { this.#balance += n; } }",
    },
    {
      name: "regression: a builder with public fields and `this`-returning setters",
      code: [
        "class QueryBuilder {",
        "  limit = 10;",
        "  name = '';",
        "  setLimit(n: number) { this.limit = n; return this; }",
        "  setName(n: string) { this.name = n; return this; }",
        "}",
      ].join("\n"),
    },
    {
      name: "readonly and protected fields are not public mutable fields",
      code: "class A { readonly id = 1; protected count = 0; area() { return this.id * 2; } }",
    },
    {
      name: "accessors and the constructor are not behaviour",
      code: "class A { x = 0; constructor(x: number) { this.x = x; } get double() { return this.x * 2; } set double(v) { this.x = v / 2; } }",
    },
    {
      name: "static members are the class's, not the instance's",
      code: "class A { static count = 0; static next() { return ++A.count; } private x = 1; }",
    },
    {
      name: "a readonly or private parameter property",
      code: "class A { constructor(readonly x: number, private y: number) {} sum() { return this.x + this.y; } }",
    },
    {
      name: "a constructor that assigns a private field",
      code: "class A { #x; constructor() { this.#x = 1; } f() { return this.#x; } }",
    },
    {
      name: "a field holding a function is a method, not data",
      code: "class A { onClick = () => {}; #n = 0; }",
    },
  ],
  invalid: [
    {
      name: "a public field and a method with behaviour",
      code: "class Rectangle { width = 0; height = 0; area() { return this.width * this.height; } }",
      errors: [{ messageId: "hybrid", data: { name: "Rectangle", field: "width", method: "area" }, line: 1, column: 7 }],
      output: null,
    },
    {
      name: "a field the constructor creates without declaring it",
      code: "class Circle { constructor(r) { this.radius = r; } area() { return Math.PI * this.radius ** 2; } }",
      filename: "file.js",
      errors: [{ messageId: "hybrid", data: { name: "Circle", field: "radius", method: "area" } }],
      output: null,
    },
    {
      name: "a public parameter property",
      code: "class A { constructor(public name: string) {} greet() { return 'hi ' + this.name; } }",
      errors: [{ messageId: "hybrid", data: { name: "A", field: "name", method: "greet" } }],
      output: null,
    },
    {
      name: "an explicitly public field, and a void method is behaviour",
      code: "class A { public items: string[] = []; render() { console.log(this.items); } }",
      errors: [{ messageId: "hybrid", data: { name: "A", field: "items", method: "render" } }],
      output: null,
    },
    {
      name: "a method that returns `this` on one path only has behaviour",
      code: "class A { n = 0; inc() { if (this.n > 9) return 0; this.n++; return this; } }",
      errors: 1,
      output: null,
    },
    {
      name: "a class expression",
      code: "const Shape = class { side = 1; area() { return this.side ** 2; } };",
      errors: [{ messageId: "hybrid", data: { name: "Shape", field: "side", method: "area" } }],
      output: null,
    },
  ],
});
