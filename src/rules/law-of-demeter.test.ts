import { runTypedRuleTests, runWithoutTypeInformation } from "../testing/run-typed-rule-tests.ts";
import rule from "./law-of-demeter.ts";

/** A class instance in the book's sense: it has methods and private state. */
const BUCKET = "class Bucket { private items: string[] = []; add(item: string): void { this.items.push(item); } }";
const REGISTRY = `${BUCKET}\nclass Registry { private buckets = new Map<string, Bucket>(); getOrCreate(key: string): Bucket { return this.buckets.get(key) ?? new Bucket(); } }`;

const OPTS = "interface Opts { a: number; b: string; limits: { max: number } }";

runTypedRuleTests("law-of-demeter", rule, {
  valid: [
    // Regression cases (catalog row 6): parameter objects are data structures, read through properties.
    `${OPTS}\nfunction f({ a, b }: Opts) { return a + b; }`,
    `${OPTS}\nfunction g(opts: Opts) { return opts.limits.max; }`,
    // Talking to friends: a field, a parameter, an object the method created.
    `${REGISTRY}\nclass User { private bucket = new Bucket(); save(item: string) { this.bucket.add(item); } }`,
    `${BUCKET}\nfunction save(bucket: Bucket, item: string) { bucket.add(item); }`,
    `${BUCKET}\nfunction save(item: string) { new Bucket().add(item); }`,
    // Property access of any kind, even on a returned object.
    `${BUCKET}\nclass Shelf { private top = new Bucket(); first(): Bucket { return this.top; } }\nfunction read(shelf: Shelf) { return shelf.first().constructor; }`,
    // Fluent APIs: the result is the receiver's own type.
    "class Query { private parts: string[] = []; where(part: string): this { this.parts.push(part); return this; } limit(n: number): Query { this.parts.push(`limit ${n}`); return this; } run(): string { return this.parts.join(' '); } }\nfunction q(query: Query) { return query.where('a').limit(1).run(); }",
    "class Builder<T> { private items: T[] = []; with<U>(item: U): Builder<U> { return new Builder<U>(); } build(): T[] { return this.items; } }\nfunction b(builder: Builder<number>) { return builder.with('x').build(); }",
    // A static factory method creates the object it returns.
    "class Complex { private constructor(private readonly real: number) {} static fromRealNumber(real: number): Complex { return new Complex(real); } plus(other: Complex): Complex { return new Complex(this.real + other.real); } }\nfunction c(z: Complex) { return Complex.fromRealNumber(1).plus(z); }",
    // Data structures: interfaces, type aliases, classes with only public fields.
    "interface Options { getScratchDir(): { absolutePath: string; resolve(): string } }\ninterface Ctxt { getOptions(): Options }\nfunction d(ctxt: Ctxt) { return ctxt.getOptions().getScratchDir().resolve(); }",
    "type Point = { x: number; norm(): number };\ninterface Shape { center(): Point }\nfunction e(shape: Shape) { return shape.center().norm(); }",
    "class Point { x = 0; y = 0; norm(): number { return Math.hypot(this.x, this.y); } }\nclass Shape { private origin = new Point(); center(): Point { return this.origin; } }\nfunction h(shape: Shape) { return shape.center().norm(); }",
    // Standard library types.
    "async function load(fetchText: () => Promise<string>) { return fetchText().then((t) => t.trim()); }",
    "function words(text: string) { return text.trim().toUpperCase().split(' ').filter(Boolean).map((w) => w.length); }",
    "function chain(p: Promise<number>) { return p.then((n) => n + 1).catch(() => 0).finally(() => undefined); }",
    "function keys(m: Map<string, number>) { return m.keys().next(); }",
    // node_modules types: `RuleTester` is a class with methods and #private state, declared in oxlint's package.
    "import { RuleTester } from 'oxlint/plugins-dev';\ninterface Factory { make(): RuleTester }\nfunction t(factory: Factory) { factory.make().run('x', {} as never, { valid: [], invalid: [] }); }",
    // An element taken out of a standard container the class holds: the method called first is the library's.
    `${BUCKET}\nclass Registry { private buckets = new Map<string, Bucket>(); put(key: string, item: string) { this.buckets.get(key)?.add(item); } }`,
    `${BUCKET}\nfunction first(buckets: Bucket[], item: string) { buckets.find(Boolean)!.add(item); buckets.at(0)?.add(item); }`,
    // `any` carries no type to check.
    "function anyChain(x: any) { return x.a().b(); }",
    // A free function call is not `a.b().c()`.
    `${BUCKET}\ndeclare function makeBucket(): Bucket;\nfunction m(item: string) { makeBucket().add(item); }`,
  ],
  invalid: [
    {
      name: "the approved firing: a getOrCreate caller, when the result is an object",
      code: `${REGISTRY}\nfunction put(registry: Registry, key: string, item: string) { registry.getOrCreate(key).add(item); }`,
      errors: [{ messageId: "stranger", line: 3, data: { method: "add", inner: "getOrCreate", type: "Bucket" } }],
    },
    {
      name: "a stranger reached through one of the class's own fields",
      code: `${REGISTRY}\nclass Service { private registry = new Registry(); put(key: string, item: string) { this.registry.getOrCreate(key).add(item); } }`,
      errors: [{ messageId: "stranger", line: 3 }],
    },
    {
      name: "a #private field and an optional chain",
      code: "class Account { #balance = 0; deposit(n: number): void { this.#balance += n; } }\nclass Bank { private accounts: Account[] = []; find(id: number): Account | undefined { return this.accounts[id]; } }\nfunction pay(bank: Bank) { bank.find(1)?.deposit(5); }",
      errors: [{ messageId: "stranger", line: 3, data: { method: "deposit", inner: "find", type: "Account" } }],
    },
    {
      name: "a protected parameter property is non-public state",
      code: "class Engine { constructor(protected rpm: number) {} start(): void { this.rpm = 900; } }\nclass Car { private engine = new Engine(0); getEngine(): Engine { return this.engine; } }\nfunction drive(car: Car) { car.getEngine().start(); }",
      errors: [{ messageId: "stranger", line: 3 }],
    },
  ],
});

runWithoutTypeInformation("law-of-demeter", rule, [`${REGISTRY}\nfunction put(registry: Registry, key: string, item: string) { registry.getOrCreate(key).add(item); }`]);
