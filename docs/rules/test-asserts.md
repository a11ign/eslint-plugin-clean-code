# clean-code-book/test-asserts

Every test asserts, so it passes or fails by itself.

- **Config:** `recommended` (test files only: `*.test.*`, `*.spec.*`, `__tests__/`)
- **Fix:** none
- **Catalog entry:** TST-05

## What the book says

> "The tests should have a boolean output. Either they pass or they fail. You should not have to read through a log file to tell whether the tests pass."

*Clean Code, 2nd Edition*, chapter 15 Clean Tests § Self-Validating (bookCTX chunk 24).

## What it reports

An `it` or `test` callback that makes no assertion, including the `.only`, `.concurrent`, `.each(table)` forms and `node:test`'s `test(name, options, fn)`. The report is on the test function's name (`it`, `test.only` …).

A call is an assertion when:

- its callee starts with `expect` or `assert`: `expect(…)`, `expect.assertions(1)`, `assert(…)`, `assert.equal(…)`, `assert.strict.deepEqual(…)`, and the book's composed assertions such as `assertTaxFor(…)` or `expectTax(…)`,
- a property in its callee is named exactly `assert` or `expect`: `node:test`'s `t.assert.strictEqual(…)`, Vitest's `context.expect(…)`, `chai.expect(…)`, `sinon.assert.calledOnce(…)`, supertest's `request(app).get("/").expect(200)`. A property that only starts with them (`user.assertValid()`) is not counted, because a method of the code under test can have that name,
- its callee, or the object at the root of a member callee, is a binding imported or required at the top of the file from an assertion module, under any local name:
  - every import of `assert`, `node:assert`, `assert/strict`, `node:assert/strict` and `chai`: `import { equal } from "node:assert/strict"` then `equal(…)`, `import { strict } from "node:assert"` then `strict.equal(…)`, `import * as a from "node:assert"` then `a.ok(…)`, `import check from "assert/strict"`,
  - `expect` and `assert` from `vitest`, and `expect` from `@jest/globals` (`import { expect as want } from "vitest"`). Their other exports, such as `vi` and `jest`, are not assertions,
  - the same through `require`: `const check = require("node:assert")`, `const { equal: same } = require("node:assert/strict")`, `const { expect } = require("chai")`.

  The binding is resolved through scope analysis, so a local variable of the same name that shadows the import is not counted, and a binding of the same name from another module (`import { equal } from "./math"`) is not an assertion. A `require` inside a function is not read.
- it matches a name in the `assertFunctionNames` option.

The assertion may be anywhere inside the test, in a nested callback too (`waitFor(() => expect(…))`, `list.forEach((n) => assert.ok(n))`). A `node:test` subtest (`t.test(…)`) is counted as part of its parent test: its assertions count for the parent, and it is not checked on its own.

It does not check:

- `describe`, which is a group of tests,
- a test that is skipped (`.skip`, `xit`, `{ skip: true }`, `{ skip: "reason" }`) or a to-do (`.todo`, `{ todo: true }`), as the catalog says; `no-disabled-tests` deals with skipped tests,
- a test with no callback (Mocha's pending `it("name")`), or one whose callback is passed by name (`it("adds", checkAddition)`), because the body is not there to read,
- an assertion in a helper defined elsewhere and called from the test, unless the helper's name starts with `assert` or `expect` or is in `assertFunctionNames`. Naming the helper as an assertion is the book's composed-assertion style.

## Examples

Incorrect:

```ts
it("adds", () => {
  console.log(add(1, 2));
});
```

Correct:

```ts
import assert from "node:assert";

test("adds", () => {
  assert.equal(add(1, 2), 3);
});

it("taxes the first bracket", () => {
  assertTaxFor(10_000, 1_000);
});
```

## Options

```json
{ "assertFunctionNames": ["verify*", "request.**.expect"] }
```

`assertFunctionNames` (default `[]`) adds functions that count as assertions. Each name is matched against the whole callee, with its parts separated by `.` (calls in a chain are passed through, so `request(app).get("/").expect` is `request.get.expect`). `*` matches any characters within one part, and `**` matches any number of parts. `verify*` matches `verifyTotals(…)` but not `helpers.verifyTotals(…)`; use `**.verify*` for that. These names are added to the built-in ones above.

## Why there is no autofix

The missing assertion has to say what the test expects, and only the person who wrote the test knows that.
