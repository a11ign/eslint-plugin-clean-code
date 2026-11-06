import { runRuleTests } from "../testing/run-rule-tests.ts";
import rule from "./one-switch-per-type.ts";

runRuleTests("one-switch-per-type", rule, {
  valid: [
    {
      name: "one switch on the type code, in a factory",
      code: "class Shape { type = 'square'; area() { switch (this.type) { case 'square': return 1; default: return 0; } } }",
    },
    {
      name: "regression: two functions that each switch on a discriminated union passed as data",
      code: [
        "type Shape = { kind: 'square'; side: number } | { kind: 'circle'; radius: number };",
        "function area(shape: Shape) { switch (shape.kind) { case 'square': return shape.side ** 2; case 'circle': return Math.PI * shape.radius ** 2; } }",
        "function perimeter(shape: Shape) { switch (shape.kind) { case 'square': return 4 * shape.side; case 'circle': return 2 * Math.PI * shape.radius; } }",
      ].join("\n"),
    },
    {
      name: "regression: a class that switches on a state field in two methods",
      code: [
        "class Connection {",
        "  state: 'open' | 'closed' = 'closed';",
        "  send(data: string) { switch (this.state) { case 'open': return write(data); case 'closed': throw new Error('closed'); } }",
        "  close() { switch (this.state) { case 'open': this.state = 'closed'; break; case 'closed': break; } }",
        "}",
      ].join("\n"),
    },
    {
      name: "switches on the type codes of two different classes",
      code: "class A { kind = 1; f() { switch (this.kind) {} } }\nclass B { kind = 1; g() { switch (this.kind) {} } }",
    },
    {
      name: "a nested function binds its own `this`",
      code: "class A { type = 1; f() { switch (this.type) {} } g() { return function () { switch (this.type) {} }; } }",
    },
    {
      name: "a switch on another object's type code",
      code: "class A { f(other) { switch (other.type) {} } g(other) { switch (other.type) {} } }",
    },
    {
      name: "two different type codes",
      code: "class A { f() { switch (this.type) {} } g() { switch (this.shapeKind) {} } }",
    },
    {
      name: "a static type code and an instance one are different members",
      code: "class A { static kind = 1; kind = 2; static f() { switch (this.kind) {} } g() { switch (this.kind) {} } }",
    },
    {
      name: "a name that only contains `type` is not a type code",
      code: "class A { f() { switch (this.typeface) {} } g() { switch (this.typeface) {} } }",
    },
  ],
  invalid: [
    {
      name: "the book's case: an employee whose pay and duties switch on its type",
      code: [
        "class Employee {",
        "  type: 'engineer' | 'manager' = 'engineer';",
        "  pay() { switch (this.type) { case 'engineer': return 1; case 'manager': return 2; } }",
        "  duties() { switch (this.type) { case 'engineer': return 'code'; case 'manager': return 'plan'; } }",
        "}",
      ].join("\n"),
      errors: [{ messageId: "secondSwitch", line: 4, data: { className: "Employee", member: "type", firstLine: "3" } }],
      output: null,
    },
    {
      name: "every switch after the first is reported",
      code: "class A { f() { switch (this.kind) {} } g() { switch (this.kind) {} } h() { switch (this.kind) {} } }",
      errors: [{ messageId: "secondSwitch" }, { messageId: "secondSwitch" }],
      output: null,
    },
    {
      name: "names ending in Type or Kind, typeCode, and private names",
      code: [
        "class A {",
        "  f() { switch (this.shapeKind) {} } g() { switch (this.shapeKind) {} }",
        "  h() { switch (this.accountType) {} } i() { switch (this.accountType) {} }",
        "  j() { switch (this.typeCode) {} } k() { switch (this.typeCode) {} }",
        "  #type = 1; l() { switch (this.#type) {} } m() { switch (this.#type) {} }",
        "}",
      ].join("\n"),
      errors: [
        { messageId: "secondSwitch", line: 2 },
        { messageId: "secondSwitch", line: 3 },
        { messageId: "secondSwitch", line: 4 },
        { messageId: "secondSwitch", line: 5, data: { className: "A", member: "#type", firstLine: "5" } },
      ],
      output: null,
    },
    {
      name: "an arrow function keeps the method's `this`, and a class expression takes its variable's name",
      code: "const Shape = class { kind = 1; f() { switch (this.kind) {} } g() { return () => { switch (this.kind) {} }; } };",
      errors: [{ messageId: "secondSwitch", data: { className: "Shape", member: "kind", firstLine: "1" } }],
      output: null,
    },
    {
      name: "`this` behind a type assertion or `!` is still the object itself",
      code: "class A { kind = 1; f() { switch ((this as A).kind) {} } g() { switch (this!.kind) {} } }",
      errors: [{ messageId: "secondSwitch", data: { className: "A", member: "kind", firstLine: "1" } }],
      output: null,
    },
    {
      name: "a switch in a field initialiser's arrow function, and a cast discriminant",
      code: "class A { kind = 1; f = () => { switch (this.kind) {} }; g() { switch ((this.kind as number)) {} } }",
      errors: [{ messageId: "secondSwitch" }],
      output: null,
    },
  ],
});
