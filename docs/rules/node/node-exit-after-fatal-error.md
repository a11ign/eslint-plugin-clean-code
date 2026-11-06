# clean-code-book/node-exit-after-fatal-error

A handler for an uncaught exception or an unhandled rejection ends the process; it does not log the error and carry on.

- **Config:** `node`
- **Fix:** no
- **Catalog entry:** NODE-04 in [`docs/catalog-node.md`](../../catalog-node.md)

## What the book says

> "Much like with the `uncaughtException` event, it's important to not allow the process to continue running since it is likely in an invalid state."

*Distributed Systems with Node.js*, Thomas Hunter II, § Exceptions, Rejections, and Emitted Errors (bookCTX `distributed-systems-with-node-js` chunk 21).

*JavaScript: The Definitive Guide* registers a handler "If you don't want these exceptions to cause your program to completely crash", and its example only logs (§ 16.1.3 Program Life Cycle, chunk 53). This rule follows *Distributed Systems with Node.js*, because the guide itself expects that "In some future version of Node, unhandled Promise rejections are expected to become fatal errors", and because a log-only handler is the process-wide form of the log-and-swallow `catch` that `ai-no-ceremonial-catch` reports.

## What it reports

A handler passed to `process.on(…)` or `process.once(…)` for `"uncaughtException"` or `"unhandledRejection"`, and a callback passed to `process.setUncaughtExceptionCaptureCallback(…)`, whose body has no path that ends the process: no call of `process.exit(…)` or `process.abort()`, no assignment to `process.exitCode`, and no `throw`. A call inside a callback in the handler counts, so `server.close(() => process.exit(1))` ends the process.

The handler can be written in place, or passed by the name of a function declaration or of a `const` set to a function in the same file.

It does not report:

- a handler that does any of those, including one that logs first and then exits;
- a handler for any other event, or a listener on an object other than `process`.

`eslint-plugin-n`'s `n/no-process-exit` and Oxlint's `unicorn/no-process-exit` would report the exit this rule asks for, so `node-extended` leaves them out.

## Examples

Incorrect:

```js
process.on("uncaughtException", (error) => {
  console.error(error);
});
```

Correct:

```js
process.on("uncaughtException", (error) => {
  console.error(error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error(reason);
  server.close(() => process.exit(1));
});
```

## Why there is no autofix

How the process should end, at once or after closing its servers, is the program's decision.
