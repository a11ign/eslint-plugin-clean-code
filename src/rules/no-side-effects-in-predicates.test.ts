import { runRuleTests } from "../testing/run-rule-tests.ts";
import rule from "./no-side-effects-in-predicates.ts";

runRuleTests("no-side-effects-in-predicates", rule, {
  valid: [
    "function isEven(n) { return n % 2 === 0; }",
    { name: "writes to its own locals and parameters", code: "function hasItems(list, min) { let count = 0; for (const item of list) count++; min = min ?? 1; const seen = {}; seen.last = count; return count >= min; }" },
    { name: "a name that is not a predicate", code: "let calls = 0; function isolate() { calls++; } function issue() { calls++; } function hash() { calls++; } class A { record() { this.calls++; } }" },
    { name: "a nested regular function has its own `this`", code: "class A { isReady() { const reset = function () { this.done = false; }; return reset; } }" },
    { name: "a class field initializer has the class's `this`", code: "class A { isReady() { return class { done = (this.count = 1); }; } }" },
    { name: "a method call is not an assignment (left to the type-aware rules)", code: "class A { hasKey(key) { this.cache.set(key, 1); return true; } }" },
    { name: "a write inside a nested function to that function's own local", code: "function canRun(tasks) { return tasks.some((task) => { let ok = task.ready; ok = !ok; return ok; }); }" },
  ],
  invalid: [
    {
      name: "the book's case: a predicate that changes a module variable",
      code: "let factorIndex = 0;\nfunction isMultipleOfNthPrimeFactor(candidate, n) {\n  factorIndex++;\n  return candidate % n === 0;\n}",
      output: null,
      errors: [{ messageId: "sideEffect", line: 3, data: { name: "isMultipleOfNthPrimeFactor", target: "factorIndex" } }],
    },
    { name: "a method that writes to `this`", code: "class Order { isValid() { this.checked = true; return this.total > 0; } }", output: null, errors: [{ messageId: "sideEffect", data: { name: "isValid", target: "this.checked" } }] },
    { name: "a getter that writes to `this` through an arrow", code: "class Order { get hasLines() { [1].forEach(() => { this.count += 1; }); return true; } }", output: null, errors: 1 },
    { name: "a property of a parameter", code: "function canShip(order) { order.status = 'checked'; return true; }", output: null, errors: [{ messageId: "sideEffect", data: { name: "canShip", target: "order.status" } }] },
    { name: "a closure variable, from a nested callback", code: "function outer() {\n  let seen = 0;\n  const shouldRetry = (errors) => errors.some(() => { seen += 1; return true; });\n  return shouldRetry;\n}", output: null, errors: [{ messageId: "sideEffect", line: 3, data: { name: "shouldRetry", target: "seen" } }] },
    { name: "an undeclared global", code: "function isReady() { readyChecks = 1; return true; }", output: null, errors: 1 },
    { name: "a destructuring assignment and a `for…of` target", code: "let a, b;\nfunction hasPair(list) {\n  [a, b] = list;\n  for (a of list) {}\n  return true;\n}", output: null, errors: [{ messageId: "sideEffect", line: 3 }, { messageId: "sideEffect", line: 3 }, { messageId: "sideEffect", line: 4 }] },
    { name: "a class property arrow and a `#private` method", code: "class A { isOpen = () => { this.polls++; return true; }; #canClose() { this.polls = 0; return true; } }", output: null, errors: 2 },
    { name: "a property of an object declared outside", code: "const cache = {};\nconst isCached = function (key) { cache.last = key; return key in cache; };", output: null, errors: 1 },
    { name: "an object-literal method", code: "const store = { hasItem(k) { this.lastKey = k; return true; } };", output: null, errors: 1 },
  ],
});
