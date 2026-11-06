# clean-code-book/ai-no-ceremonial-catch

Don't catch an error only to log it and rethrow it, or only to log it and carry on.

- **Config:** `ai`
- **Fix:** no
- **Catalog entry:** AI-02 in [`docs/catalog-ai.md`](../../catalog-ai.md)

## The AI pattern

Generated code wraps calls in `try`/`catch` by reflex, and the `catch` only logs: `catch (error) { console.error(error); throw error; }`, or `catch (error) { logger.error(error); }`. Log and rethrow logs the same error twice and adds nothing the stack trace did not have. Log and swallow turns a failure into a log line, and the caller carries on with a result that was never produced.

**Language basis:** JS/TS-specific. JavaScript and TypeScript have no checked exceptions (*Programming TypeScript*, bookCTX chunk 13), so nothing forces a function to catch what it calls. An error that is not caught bubbles up to the boundary that reports it to monitoring (chunk 18). *Head First C#* (chunk 52) puts the principle as handling exceptions, not burying them.

## What it reports

- A `catch` whose body is one or more logging calls followed by `throw` of the caught parameter.
- A `catch` whose body is only logging calls, unless `allowSwallow` is `true`.

A logging call is a call statement, awaited or not, on `console.*`, or on an identifier or member chain whose last name is `log`, `logger`, `logError`, `warn` or `error` (`logger.error(e)`, `this.logger.error(e)`, `logError(e)`, `logger(e)`).

It does not report:

- an empty `catch`, which `no-empty` reports;
- a `catch` that only rethrows, which ESLint's `no-useless-catch` reports;
- a `catch` that does anything else: returns a fallback, retries, throws a new error with the original as its `cause`, or throws something other than the caught error.

## Examples

Incorrect:

```ts
try {
  await exportInvoices();
} catch (error) {
  console.error(error);
  throw error;
}

try {
  await exportInvoices();
} catch (error) {
  logger.error(error);
}
```

Correct:

```ts
await exportInvoices();

try {
  await exportInvoices();
} catch (error) {
  throw new Error("Exporting the invoices failed", { cause: error });
}
```

## Options

- `allowSwallow` (`boolean`, default `false`): `true` stops the rule reporting a `catch` that only logs and does not rethrow, for a team that keeps the book's boundary pattern. Log and rethrow is still reported.
- `loggerNames` (`string[]`, default `["log", "logger", "logError", "warn", "error"]`): the last names of a callee that make a call a logging call. The list replaces the default; calls on `console` always count.

## Where this departs from the book

*Clean Code, 2nd Edition*, chapter 8 § Extract Try/Catch Blocks (bookCTX chunk 14), shows a `delete()` function whose `catch` only logs:

```java
public void delete(Page page) {
  try {
    deletePageAndAllReferences(page);
  }
  catch (Exception e) {
    logError(e);
  }
}
```

This rule reports that shape. The book's example is Java, and it rests on a checked exception: `deletePageAndAllReferences` is declared `throws Exception`, so every caller must either catch it or declare it in turn. `delete()` is the boundary that ends that chain, and the example is about extracting the `try` and `catch` bodies into functions of their own, not about what the `catch` should do. JavaScript and TypeScript have no checked exceptions and no `throws` clause, so nothing forces that boundary: an uncaught error already travels up to the place that handles it. A `catch` that only logs then does nothing but hide the failure.

A project that runs both `recommended` and `ai` can be reported for following the book's example. To keep the boundary pattern, set `allowSwallow: true`; log and rethrow stays reported, because it has no counterpart in the book.

## Why there is no autofix

Removing the `try`/`catch` changes where an error is logged, and what a swallowing `catch` should do instead (recover, retry, return a result, or propagate) is a decision about the program's behaviour.
