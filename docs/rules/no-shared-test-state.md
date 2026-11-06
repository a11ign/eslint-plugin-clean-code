# clean-code-book/no-shared-test-state

A test does not assign variables declared outside it, so no test sets up the conditions for the next.

- **Config:** `recommended` (test files only: `*.test.*`, `*.spec.*`, `__tests__/`)
- **Fix:** none
- **Catalog entry:** TST-04

## What the book says

> "Tests should not depend on each other. One test should not set up the conditions for the next test. You should be able to run each test independently and run the tests in any order you like."

*Clean Code, 2nd Edition*, chapter 15 Clean Tests § Isolated (bookCTX chunk 24).

## What it reports

An assignment, inside an `it` or `test` callback (any form: `.skip`, `.only`, `.each(table)`, `node:test` options), to a variable declared outside that test: `x = …`, `x += …`, `x++`, destructuring (`[a, b] = …`, `({ a } = …)`) and `for (x of …)`. The assignment counts in a nested callback of the test too (`load().then((r) => { result = r; })`). Each variable written is reported where it is written.

It does not report:

- a variable declared inside the test, including in its nested functions and loops,
- assignments in `beforeEach` and `afterEach` hooks, which reset state for every test,
- an assignment in a test to a variable that a `beforeEach` or `afterEach` hook in the same file also assigns. The hook resets it for every test, so the test's write cannot reach the next test. This reads the catalog's "assignments in hooks are allowed, because they reset state for every test" as covering the variable, not only the hook's own line: otherwise the rule would report state that is already isolated, and its own advice (reset it in `beforeEach`) would not silence it.
- a write to a property (`state.count = 1`, `process.env.TZ = "UTC"`). The catalog's rule is about variables; property writes on mocks and the environment are too common in tests to tell apart from shared state by syntax.
- assignments in a `describe` body or in `beforeAll` / `afterAll`, which are setup, not tests. A test that assigns a variable set only in `beforeAll` is still reported, because `beforeAll` runs once, not for every test.
- an assignment to a variable with no declaration in the file (an implicit global), whose scope cannot be told.

## Examples

Incorrect:

```ts
describe("cart", () => {
  let cart: Cart;

  it("creates", () => {
    cart = new Cart();
    expect(cart.size).toBe(0);
  });

  it("adds", () => {
    cart.add(item); // depends on the test above having run first
    expect(cart.size).toBe(1);
  });
});
```

Correct:

```ts
describe("cart", () => {
  let cart: Cart;

  beforeEach(() => {
    cart = new Cart();
  });

  it("starts empty", () => {
    expect(cart.size).toBe(0);
  });

  it("adds", () => {
    cart.add(item);
    expect(cart.size).toBe(1);
  });
});
```

## Why there is no autofix

Moving the state into each test or into a hook restructures the test file, and which tests need which starting value is a decision about what each test means.
