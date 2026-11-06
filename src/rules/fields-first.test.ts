import { runRuleTests } from "../testing/run-rule-tests.ts";
import rule from "./fields-first.ts";

const report = [{ messageId: "fieldAfterMember" }];

runRuleTests("fields-first", rule, {
  valid: [
    { name: "fields above the methods", code: "class A {\n  x = 1;\n  static y = 2;\n  #z = 3;\n  constructor() {}\n  m() { return this.#z; }\n}" },
    { name: "a class with only methods", code: "class A {\n  constructor() {}\n  m() {}\n}" },
    { name: "an index signature is not a field", code: "class A {\n  m() {}\n  [key: string]: unknown;\n}" },
    { name: "a class expression", code: "const A = class {\n  x = 1;\n  get y() { return this.x; }\n};" },
  ],
  invalid: [
    {
      name: "a field after a method moves up, and fields still initialise in the same order",
      code: "const log = [];\nclass Counter {\n  count = log.push(\"count\");\n\n  increment() {\n    this.count += 1;\n    return this.count;\n  }\n\n  step = log.push(\"step\");\n}\n",
      output: "const log = [];\nclass Counter {\n  count = log.push(\"count\");\n\n  step = log.push(\"step\");\n\n  increment() {\n    this.count += 1;\n    return this.count;\n  }\n}\n",
      errors: [{ messageId: "fieldAfterMember", data: { name: "step", member: "increment" }, line: 10 }],
      behaviour: "(() => { const c = new Counter(); const d = new Counter(); return [c.count, c.step, c.increment(), d.step, log, Object.keys(c)]; })()",
    },
    {
      name: "regression row 3: a moved field without `;` followed by `[Symbol.iterator]() {}` gets a `;`",
      code: "class Bag {\n  [Symbol.iterator]() {\n    return [this.size][Symbol.iterator]()\n  }\n  size = 0\n}\n",
      output: "class Bag {\n  size = 0;\n  [Symbol.iterator]() {\n    return [this.size][Symbol.iterator]()\n  }\n}\n",
      errors: [{ messageId: "fieldAfterMember", data: { name: "size", member: "[Symbol.iterator]" } }],
      behaviour: ["[...new Bag()]", "new Bag().size", "Object.keys(new Bag())"],
    },
    {
      name: "regression row 3: a moved field without `;` followed by a generator method `*values()` gets a `;`",
      code: "export class Bag {\n  *values() {\n    yield* this.items\n  }\n  items = [1, 2]\n}\n",
      output: "export class Bag {\n  items = [1, 2];\n  *values() {\n    yield* this.items\n  }\n}\n",
      filename: "file.js",
      errors: [{ messageId: "fieldAfterMember", data: { name: "items", member: "values" } }],
      behaviour: ["[...new Bag().values()]", "new Bag().items"],
    },
    {
      name: "regression row 3: a `;[1, 2].forEach(f)` line in a method stays as it is",
      code: "class Tally {\n  add() {\n    const f = (n) => this.seen.push(n)\n    ;[1, 2].forEach(f)\n    return this.seen\n  }\n  seen = []\n}\n",
      output: "class Tally {\n  seen = []\n  add() {\n    const f = (n) => this.seen.push(n)\n    ;[1, 2].forEach(f)\n    return this.seen\n  }\n}\n",
      errors: report,
      behaviour: ["new Tally().add()", "(() => { const t = new Tally(); t.add(); return t.add(); })()"],
    },
    {
      name: "fields spread through the class move up in order, with their comments",
      code: "class Shape {\n  constructor(name) {\n    this.name = name\n  }\n  /** The number of sides. */\n  sides = 3\n  area() {\n    return 0\n  }\n  static #count = 0\n  static next() {\n    return ++Shape.#count\n  }\n}\n",
      output: "class Shape {\n  /** The number of sides. */\n  sides = 3\n  static #count = 0\n  constructor(name) {\n    this.name = name\n  }\n  area() {\n    return 0\n  }\n  static next() {\n    return ++Shape.#count\n  }\n}\n",
      filename: "file.js",
      errors: [
        { messageId: "fieldAfterMember", data: { name: "sides", member: "constructor" } },
        { messageId: "fieldAfterMember", data: { name: "#count", member: "constructor" } },
      ],
      behaviour: ["new Shape('t').sides", "Object.keys(new Shape('a'))", "[Shape.next(), Shape.next()]", "Object.getOwnPropertyNames(Shape.prototype)", "Object.getOwnPropertyNames(Shape)"],
    },
    {
      name: "consecutive fields move as one run",
      code: "class Point {\n  norm(): number {\n    return Math.hypot(this.x, this.y);\n  }\n\n  x: number = 3;\n  y: number = this.x + 1;\n}\n",
      output: "class Point {\n  x: number = 3;\n  y: number = this.x + 1;\n  norm(): number {\n    return Math.hypot(this.x, this.y);\n  }\n}\n",
      errors: 2,
      behaviour: ["new Point().norm()", "Object.entries(new Point())"],
    },
    {
      name: "regression row 2: private and protected constructors and an overloaded method keep every member",
      code: "class Registry {\n  private constructor() {}\n  lookup(key: string): string;\n  lookup(key: number): string;\n  lookup(key: unknown): string {\n    return `${this.prefix}${String(key)}`;\n  }\n  prefix = \"r:\";\n  static create(): Registry {\n    return new Registry();\n  }\n}\nclass Base {\n  protected constructor() {}\n  label = \"base\";\n}\n",
      output: "class Registry {\n  prefix = \"r:\";\n  private constructor() {}\n  lookup(key: string): string;\n  lookup(key: number): string;\n  lookup(key: unknown): string {\n    return `${this.prefix}${String(key)}`;\n  }\n  static create(): Registry {\n    return new Registry();\n  }\n}\nclass Base {\n  label = \"base\";\n  protected constructor() {}\n}\n",
      errors: 2,
      behaviour: ["Registry.create().lookup(1)", "Registry.create().lookup('k')", "new Base().label", "Object.getOwnPropertyNames(Registry.prototype)"],
    },
    {
      name: "a field after an accessor",
      code: "class Box {\n  get size(): number {\n    return this.items.length;\n  }\n  readonly items: number[] = [1, 2];\n}\n",
      output: "class Box {\n  readonly items: number[] = [1, 2];\n  get size(): number {\n    return this.items.length;\n  }\n}\n",
      errors: [{ messageId: "fieldAfterMember", data: { name: "items", member: "size" } }],
      behaviour: ["new Box().size", "new Box().items"],
    },
    {
      name: "no fix when a moved field has a computed key",
      code: "const k = \"x\";\nclass A {\n  m() {}\n  [k] = 1;\n}\n",
      output: null,
      errors: [{ messageId: "fieldAfterMember", data: { name: "[k]", member: "m" } }],
    },
    {
      name: "no fix when a member has a decorator",
      code: "class A {\n  @dec m() {}\n  x = 1;\n}\n",
      output: null,
      errors: report,
    },
    {
      name: "no fix when the class has a `static {}` block",
      code: "class A {\n  static {}\n  static x = 1;\n}\n",
      output: null,
      errors: [{ messageId: "fieldAfterMember", data: { name: "x", member: "static {}" } }],
    },
    {
      name: "no fix when an initializer refers to the class by name",
      code: "class A {\n  static m() { return 1; }\n  static x = A.m();\n}\n",
      output: null,
      errors: report,
    },
    {
      name: "no fix when a static initializer uses `this`",
      code: "class A {\n  static m() { return 1; }\n  static x = this.m();\n}\n",
      output: null,
      errors: report,
    },
    {
      name: "no fix when the class has an auto-accessor, whose storage initialises in field order",
      code: "class A {\n  accessor a = 1;\n  b = 2;\n}\n",
      output: null,
      errors: report,
    },
    {
      name: "no fix when the field shares its line with other code",
      code: "class A { m() {} x = 1; }\n",
      output: null,
      errors: report,
    },
  ],
});
