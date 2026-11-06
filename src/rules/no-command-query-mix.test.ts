import { runRuleTests } from "../testing/run-rule-tests.ts";
import { runTypedRuleTests } from "../testing/run-typed-rule-tests.ts";
import rule from "./no-command-query-mix.ts";

const attributes = "const attributes: Record<string, string> = {};";
const bookSet = `${attributes}\nfunction set(attribute: string, value: string): boolean { if (attribute in attributes) return false; attributes[attribute] = value; return true; }`;

const storeClass = [
  "class Store {",
  "  values: Record<string, number> = {};",
  "  set(key: string, value: number): boolean { const had = key in this.values; this.values[key] = value; return !had === true; }",
  "  has(key: string): boolean { return key in this.values; }",
  "}",
].join("\n");

runRuleTests("no-command-query-mix", rule, {
  valid: [
    {
      name: "a query used as a condition",
      code: `${attributes}\nfunction attributeExists(a: string) { return a in attributes; }\nif (attributeExists("username")) {}`,
    },
    {
      name: "a command called as a statement",
      code: `${bookSet}\nset("username", "unclebob");`,
    },
    {
      name: "regression: a getOrCreate method returns the value, not a boolean",
      code: [
        "class Registry {",
        "  #items = new Map<string, object>();",
        "  getOrCreate(key: string) { let item = this.#items.get(key); if (item === undefined) { item = {}; this.#items.set(key, item); } return item; }",
        "  use(key: string) { if (this.getOrCreate(key)) return 1; return 0; }",
        "}",
      ].join("\n"),
    },
    {
      name: "regression: a fluent setter returns `this`",
      code: "class Person { name = ''; setName(n: string) { this.name = n; return this; } rename(n: string) { return this.setName(n) ? 1 : 0; } }",
    },
    {
      name: "regression: Map.prototype.delete and Set.prototype.add used as conditions",
      code: "const seen = new Set<string>(); const cache = new Map<string, number>();\nif (cache.delete('a')) {}\nwhile (seen.add('b')) { break; }\nconst x = seen.add('c') ? 1 : 0;",
    },
    {
      name: "without type information, `obj.method()` is not resolved even with checkMethodCalls on",
      code: `${storeClass}\nconst store = new Store();\nif (store.set('a', 1)) {}`,
      options: [{ checkMethodCalls: true }],
    },
    {
      name: "writes to local variables and to members of local objects are not changes of outer state",
      code: "function check(xs: number[]) { let total = 0; const seen = { n: 0 }; for (const x of xs) { total += x; seen.n++; } return total > 10; }\nif (check([1])) {}",
    },
    {
      name: "a function that changes state but returns a value that is not a boolean answer",
      code: "let n = 0; function next() { n += 1; return n; }\nif (next()) {}",
    },
    {
      name: "a function that returns a comparison but changes nothing",
      code: "function big(n: number) { return n > 10; }\nwhile (big(3)) {}",
    },
    {
      name: "an imported function's body cannot be seen",
      code: "import { set } from './attributes';\nif (set('username', 'unclebob')) {}",
    },
    {
      name: "a nested function binds its own `this`, so `this.set()` there is not the class's",
      code: `class A { n = 0; set() { this.n = 1; return true; } f() { return function (this: { set(): boolean }) { if (this.set()) {} }; } }`,
    },
    {
      name: "a call that is only part of the condition",
      code: `${bookSet}\nif (set("a", "b") && ready) {}`,
    },
  ],
  invalid: [
    {
      name: "the book's example: `set` writes an attribute and answers whether it existed",
      code: `${bookSet}\nif (set("username", "unclebob")) {}`,
      errors: [{ messageId: "commandAsQuery", line: 3, data: { callee: "set", state: "attributes[attribute]" } }],
      output: null,
    },
    {
      name: "`this.method()` of the enclosing class, in a ternary and a `while`",
      code: [
        "class Queue {",
        "  count = 0;",
        "  tryTake(): boolean { if (this.count === 0) return false; this.count--; return true; }",
        "  drain() { while (this.tryTake()) {} return this.tryTake() ? 'more' : 'empty'; }",
        "}",
      ].join("\n"),
      errors: [
        { messageId: "commandAsQuery", line: 4, data: { callee: "this.tryTake", state: "this.count" } },
        { messageId: "commandAsQuery", line: 4 },
      ],
      output: null,
    },
    {
      name: "a negated condition, an arrow function, and a write to a parameter's member",
      code: "const mark = (node: { seen: boolean }) => { const was = node.seen; node.seen = true; return was === false; };\nif (!mark(n)) {}",
      errors: [{ messageId: "commandAsQuery", data: { callee: "mark", state: "node.seen" } }],
      output: null,
    },
    {
      name: "a write to an outer variable inside a callback",
      code: "let total = 0;\nfunction addAll(xs: number[]) { xs.forEach((x) => { total += x; }); return total > 100; }\nif (addAll([1, 2])) {}",
      errors: [{ messageId: "commandAsQuery", data: { callee: "addAll", state: "total" } }],
      output: null,
    },
    {
      name: "a function declared after its use, and a static method called through `this`",
      code: "class Ids { static last = 0; static claim(id: number) { if (id <= Ids.last) return false; Ids.last = id; return true; } static f(id: number) { if (this.claim(id)) {} } }\nif (taken()) {}\nfunction taken() { flag = true; return true; }\nvar flag = false;",
      errors: [
        { messageId: "commandAsQuery", line: 1, data: { callee: "this.claim", state: "Ids.last" } },
        { messageId: "commandAsQuery", line: 2, data: { callee: "taken", state: "flag" } },
      ],
      output: null,
    },
  ],
});

runTypedRuleTests("no-command-query-mix", rule, {
  valid: [
    {
      name: "regression: Map.prototype.delete and Set.prototype.add resolve to library declarations",
      code: "const seen = new Set<string>(); const cache = new Map<string, number>();\nif (cache.delete('a')) {}\nif (seen.add('b')) {}",
      options: [{ checkMethodCalls: true }],
    },
    {
      name: "the option is off by default",
      code: `${storeClass}\nconst store = new Store();\nif (store.set('a', 1)) {}`,
    },
    {
      name: "a query method resolved through the type",
      code: `${storeClass}\nconst store = new Store();\nif (store.has('a')) {}`,
      options: [{ checkMethodCalls: true }],
    },
    {
      name: "regression: a fluent setter and a getOrCreate resolved through the type",
      code: [
        "class Builder { name = ''; setName(n: string) { this.name = n; return this; } }",
        "class Registry { #m = new Map<string, object>(); getOrCreate(k: string) { let v = this.#m.get(k); if (!v) { v = {}; this.#m.set(k, v); } return v; } }",
        "declare const b: Builder; declare const r: Registry;",
        "if (b.setName('x')) {}",
        "if (r.getOrCreate('k')) {}",
      ].join("\n"),
      options: [{ checkMethodCalls: true }],
    },
  ],
  invalid: [
    {
      name: "a project method `set` resolved through the type of the object",
      code: `${storeClass}\nconst store = new Store();\nif (store.set('a', 1)) {}`,
      options: [{ checkMethodCalls: true }],
      errors: [{ messageId: "commandAsQuery", line: 7, data: { callee: "store.set", state: "this.values[key]" } }],
    },
    {
      name: "a method of an object literal, resolved through the inferred type of its variable",
      code: "let count = 0;\nconst counter = { bump(): boolean { count++; return count > 3; } };\nwhile (counter.bump()) {}",
      options: [{ checkMethodCalls: true }],
      errors: [{ messageId: "commandAsQuery", line: 3, data: { callee: "counter.bump", state: "count" } }],
    },
    {
      name: "the syntax half still works with type information",
      code: `${bookSet}\nif (set("username", "unclebob")) {}`,
      errors: 1,
    },
  ],
});
