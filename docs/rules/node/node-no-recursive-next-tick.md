# clean-code-book/node-no-recursive-next-tick

Don't break work up by having a function schedule itself again with `process.nextTick()`.

- **Config:** `node`
- **Fix:** no
- **Catalog entry:** NODE-03 in [`docs/catalog-node.md`](../../catalog-node.md)

## What the book says

> "You should never break up such work using `process.nextTick()` . Doing so will lead to a microtask queue that never empties-your application will be trapped in the same phase forever!"

*Distributed Systems with Node.js*, Thomas Hunter II, § Event Loop Tips (bookCTX `distributed-systems-with-node-js` chunk 2).

## What it reports

A call `process.nextTick(f)` made inside the body of `f` itself, at any depth, where `f` is the name of the enclosing function declaration, named function expression or `const` function; and `process.nextTick(arguments.callee)`.

It does not report:

- `process.nextTick(f)` where `f` is a different function, or is called from outside `f`;
- `setImmediate(f)` inside `f`, which is the book's way to break up work ("using `setImmediate()` at the end of each batch to continue processing the next batch");
- a name that, where the call is written, refers to some other binding than the enclosing function, such as a nested variable of the same name, or a `let`.

## Examples

Incorrect:

```js
function drainQueue() {
  processBatch(queue.splice(0, 100));
  if (queue.length > 0) process.nextTick(drainQueue);
}
```

Correct:

```js
function drainQueue() {
  processBatch(queue.splice(0, 100));
  if (queue.length > 0) setImmediate(drainQueue);
}
```

## Why there is no autofix

`setImmediate` is the book's remedy, but it runs the function in a later phase of the event loop, which changes the order in which other callbacks run.
