import { runTypedRuleTests, runWithoutTypeInformation } from "../testing/run-typed-rule-tests.ts";
import rule from "./no-concrete-inheritance.ts";

const SHAPE = "abstract class Shape { abstract area(): number; describe(): string { return `area ${this.area()}`; } }";

runTypedRuleTests("no-concrete-inheritance", rule, {
  valid: [
    { name: "an abstract base, implementing its abstract methods", code: `${SHAPE}\nclass Square extends Shape { constructor(private side: number) { super(); } area(): number { return this.side ** 2; } }` },
    { name: "library classes are stable: Error", code: "class NotFound extends Error { constructor(id: string) { super(`missing ${id}`); } }" },
    { name: "library classes are stable: Map", code: "class Registry extends Map<string, number> { get(key: string): number | undefined { return super.get(key.toLowerCase()); } }" },
    { name: "library classes are stable: Promise", code: "class Expiry extends Promise<void> {}" },
    {
      name: "library classes are stable: a node_modules class",
      code: "import { RuleTester } from 'oxlint/plugins-dev';\nclass MyTester extends RuleTester { run(...args: Parameters<RuleTester['run']>) { super.run(...args); } }",
    },
    { name: "implementing an interface is not inheritance", code: "interface Greeter { greet(): string }\nclass Hello implements Greeter { greet() { return 'hi'; } }" },
    { name: "a class without `extends`", code: "class Plain { run() { return 1; } }" },
    { name: "a class expression extending an abstract class", code: `${SHAPE}\nconst Unit = class extends Shape { area() { return 1; } };` },
    { name: "`any` as a base gives nothing to check", code: "declare const Base: any;\nclass Derived extends Base {}" },
    { name: "a new method in a subclass of an abstract class overrides nothing", code: `${SHAPE}\nclass Circle extends Shape { area() { return 3; } radius() { return 1; } }` },
  ],
  invalid: [
    {
      name: "deriving from a concrete project class",
      code: "class Rectangle { constructor(protected w: number, protected h: number) {} area(): number { return this.w * this.h; } }\nclass Square extends Rectangle { constructor(side: number) { super(side, side); } }",
      errors: [{ messageId: "concreteBase", line: 2, data: { name: "Square", base: "Rectangle" } }],
    },
    {
      name: "deriving from a concrete class and overriding its concrete method",
      code: "class Rectangle { area(): number { return 1; } }\nclass Square extends Rectangle { override area(): number { return 2; } extra() { return 0; } }",
      errors: [
        { messageId: "concreteBase", line: 2, data: { name: "Square", base: "Rectangle" } },
        { messageId: "concreteOverride", line: 2, data: { method: "Square.area", base: "Rectangle.area" } },
      ],
    },
    {
      name: "overriding a concrete method of an abstract base (SOL-06)",
      code: `${SHAPE}\nclass Square extends Shape { area() { return 4; } describe() { return 'square'; } }`,
      errors: [{ messageId: "concreteOverride", line: 2, data: { method: "Square.describe", base: "Shape.describe" } }],
    },
    {
      name: "overriding a concrete method inherited from further up, and a concrete getter",
      code: "abstract class Base { get label(): string { return 'base'; } save(): void {} }\nabstract class Middle extends Base {}\nclass Leaf extends Middle { get label() { return 'leaf'; } save() {} }",
      errors: [
        { messageId: "concreteOverride", line: 3, data: { method: "Leaf.label", base: "Base.label" } },
        { messageId: "concreteOverride", line: 3, data: { method: "Leaf.save", base: "Base.save" } },
      ],
    },
    {
      name: "a project error hierarchy: the project's concrete error class is a project class",
      code: "class AppError extends Error {}\nclass NotFound extends AppError {}",
      errors: [{ messageId: "concreteBase", line: 2, data: { name: "NotFound", base: "AppError" } }],
    },
    {
      name: "a generic concrete base",
      code: "class Repo<T> { all(): T[] { return []; } }\nclass Users extends Repo<string> {}",
      errors: [{ messageId: "concreteBase", data: { name: "Users", base: "Repo" } }],
    },
  ],
});

runWithoutTypeInformation("no-concrete-inheritance", rule, ["class Rectangle { area() { return 1; } }\nclass Square extends Rectangle { area() { return 2; } }"]);
