import { runRuleTests } from "../testing/run-rule-tests.ts";
import rule from "./no-trivial-accessors.ts";

runRuleTests("no-trivial-accessors", rule, {
  valid: [
    {
      name: "the book's abstract vehicle: its methods express an abstraction",
      code: "class Vehicle { #fuelTankCapacity = 50; #gallons = 10; percentFuelRemaining() { return (this.#gallons / this.#fuelTankCapacity) * 100; } }",
    },
    {
      name: "a private field with no getter is hidden",
      code: "class A { #a = 1; #b = 2; get a() { return this.#a; } }",
    },
    {
      name: "a method with behaviour",
      code: "class A { #a = 1; get a() { return this.#a; } double() { return this.#a * 2; } }",
    },
    {
      name: "a getter that computes is not trivial",
      code: "class A { private a = 1; get a2() { return this.a * 2; } }",
    },
    {
      name: "a class with only public fields is an honest data structure",
      code: "class Point { x = 0; y = 0; }",
    },
    {
      name: "protected fields are not private",
      code: "class A { protected a = 1; get value() { return this.a; } }",
    },
    {
      name: "a method taking an argument is not a getter",
      code: "class A { #a = 1; a(scale) { return this.#a; } }",
    },
    {
      name: "a field holding a function is behaviour",
      code: "class A { #a = 1; get a() { return this.#a; } onChange = () => {}; }",
    },
    {
      name: "a setter that validates is behaviour",
      code: "class A { #a = 1; get a() { return this.#a; } set a(v) { if (v < 0) throw new Error(); this.#a = v; } }",
    },
  ],
  invalid: [
    {
      name: "the book's Address DTO",
      code: [
        "class Address {",
        "  private street: string;",
        "  private city: string;",
        "  constructor(street: string, city: string) { this.street = street; this.city = city; }",
        "  getStreet() { return this.street; }",
        "  getCity() { return this.city; }",
        "}",
      ].join("\n"),
      errors: [{ messageId: "trivialAccessors", line: 1, column: 7, data: { name: "Address", fields: "`street`, `city`" } }],
      output: null,
    },
    {
      name: "`#private` fields and `get` accessors",
      code: "class Point { #x = 0; #y = 0; get x() { return this.#x; } get y() { return this.#y; } }",
      filename: "file.js",
      errors: [{ messageId: "trivialAccessors", data: { name: "Point", fields: "`#x`, `#y`" } }],
      output: null,
    },
    {
      name: "trivial setters are accessors too, and static members are not instance behaviour",
      code: "class A { #a = 1; get a() { return this.#a; } set a(v) { this.#a = v; } setA(v) { this.#a = v; } static from(v) { return new A(); } }",
      errors: [{ messageId: "trivialAccessors", data: { name: "A", fields: "`#a`" } }],
      output: null,
    },
    {
      name: "private parameter properties",
      code: "class Money { constructor(private amount: number, private currency: string) {} getAmount() { return this.amount; } getCurrency() { return this.currency; } }",
      errors: [{ messageId: "trivialAccessors", data: { name: "Money", fields: "`amount`, `currency`" } }],
      output: null,
    },
  ],
});
