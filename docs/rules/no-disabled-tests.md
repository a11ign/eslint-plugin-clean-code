# clean-code-book/no-disabled-tests

Don't turn failing tests off; a test that must stay off carries its reason in a comment.

- **Config:** `recommended` (test files only: `*.test.*`, `*.spec.*`, `__tests__/`)
- **Fix:** none
- **Catalog entry:** TST-07

## What the book says

> "The more you ignore those failures, the more annoying the failure alerts become. And the more tempted you are to turn the failing tests off until you can fix them-later."

*Clean Code, 2nd Edition*, chapter 31 Small Cycles § Continuous Build (bookCTX chunk 38). Chapter 5 Comments § Warning of Consequences (bookCTX chunk 9) allows a disabled test that carries its reason, as JUnit's `@Ignore("Takes too long to run")` does.

## What it reports

A test or group of tests turned off with no reason given:

- `it.skip`, `test.skip`, `describe.skip`, also after another modifier (`test.concurrent.skip`) and in table form (`it.skip.each(table)(…)`),
- `xit`, `xtest`, `xdescribe`,
- `node:test`'s `{ skip: true }` option (`test("name", { skip: true }, fn)`).

The report is on the part that turns the test off: `skip`, the `x` name, or the `skip: true` property.

It does not report:

- a call with a comment directly before it that gives a reason. "Directly" means no blank line between the comment and the call (or the statement the call is, including `await test(…)`). A tool directive such as `// eslint-disable-next-line` is not a reason, nor is a comment with no words (`// ---`); a reason comment above a directive counts.
- `node:test`'s `{ skip: "the sandbox has no network" }`: the string is the reason, and the runner prints it.
- a skip decided at run time: `{ skip: isWindows }`, Vitest's `it.skipIf(isWindows)(…)`, Mocha's `this.skip()` and `node:test`'s `t.skip()`. These describe when a test cannot run, not a failing test turned off.
- `.todo` and `{ todo: true }`: a to-do is a test not yet written, not one turned off.
- `.only`. Focused tests are a different problem.

## Examples

Incorrect:

```ts
it.skip("imports the full catalogue", () => {
  expect(importCatalogue()).toHaveLength(12_000);
});

xdescribe("tax 2027", () => {
  // …
});
```

Correct:

```ts
// Takes too long to run; the nightly suite runs it instead.
it.skip("imports the full catalogue", () => {
  expect(importCatalogue()).toHaveLength(12_000);
});

test("fetches the rates", { skip: "the sandbox has no network" }, async () => {
  // …
});
```

## Why there is no autofix

Removing `.skip` runs a test that is failing, which changes what the suite does. Writing the reason needs to know why the test was turned off.
