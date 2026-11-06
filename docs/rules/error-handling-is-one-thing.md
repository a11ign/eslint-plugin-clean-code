# clean-code-book/error-handling-is-one-thing

A function that handles errors does nothing else: its `try` comes first and nothing follows the `catch` or `finally`.

- **Config:** `recommended`
- **Fix:** none
- **Catalog entry:** FH-07

## What the book says

> "This implies (as in the example above) that if the keyword `try` exists in a function, it should be the very first word in the function (after, perhaps, some variable declarations) and that there should be nothing after the `catch` / `finally` blocks."

*Clean Code, 2nd Edition*, chapter 8 Function Heuristics § Error Handling Is One Thing (bookCTX chunk 14).

## What it reports

In the body of a function, method or arrow function that has a `try` statement at its top level:

- each statement before the first `try` that is not a variable declaration;
- each statement after it, including a second `try`. A function declaration and a TypeScript `type` or `interface` declaration after the `try` are not reported: they do not run there (a function declaration is hoisted), as in `try { return values.reduce(add, 0); } catch { return 0; }` followed by `function add(…) {…}`.

It also reports a `try` nested in a `catch` clause of the same function, however deep. The book's "Noise Comments" example is a `try` inside a `catch`, and its fix is "improving the structure of his code" (chapter 5 Comments, bookCTX chunk 10).

It does not report a directive (`"use strict"`) or a TypeScript `type` or `interface` declaration before the `try`, which do nothing at run time, a `try` nested inside an `if` or a loop (only a top-level `try` makes the function an error handler), a `try` inside a function that is itself inside a `catch`, or a `try` at the top level of a module.

## Examples

Incorrect:

```ts
function remove(page: Page): void {
  prepare(page);
  try {
    deletePageAndAllReferences(page);
  } catch (e) {
    logError(e);
  }
  notify(page);
}
```

Correct:

```ts
function remove(page: Page): void {
  prepare(page);
  tryToDelete(page);
  notify(page);
}

function tryToDelete(page: Page): void {
  try {
    deletePageAndAllReferences(page);
  } catch (e) {
    logError(e);
  }
}
```

## Why there is no autofix

The remedy is to extract the `try` into its own function. A `return`, `break`, `continue`, `await` or `yield` inside the `try` would mean something else once moved into a new function, and the new function needs a name that says what it does.
