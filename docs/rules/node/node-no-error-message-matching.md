# clean-code-book/node-no-error-message-matching

Tell errors apart by their `code` or their class, not by matching the text of their message.

- **Config:** `node`
- **Fix:** no
- **Catalog entry:** NODE-06 in [`docs/catalog-node.md`](../../catalog-node.md)

## What the book says

> "The most common approach for targeting specific errors is to parse the actual `.message` field. When doing this, your application will need to inspect text meant for human consumption-for example, using `e.message.startsWith('Had to fallback')` . This is unfortunately quite error prone!"

*Distributed Systems with Node.js*, Thomas Hunter II, § Exceptions, Rejections, and Emitted Errors (bookCTX `distributed-systems-with-node-js` chunk 21).

## What it reports

Inside a `catch` clause, or a callback passed to `.catch(…)`, on its error parameter `e`:

- `e.message.startsWith(…)`, `.endsWith(…)`, `.includes(…)`, `.indexOf(…)`, `.match(…)` and `.search(…)`;
- `e.message === …`, `!==`, `==` and `!=`;
- `<regexp>.test(e.message)`, where the regular expression is a literal or `new RegExp(…)`.

It does not report:

- reading `e.message` to log it, or to put it in a new error;
- `e.code === …` and `e instanceof …`, which are the book's alternatives;
- the message of any other value, or a name inside the `catch` that shadows its parameter.

The book adds that "there's currently no perfect solution to the error-differentiation problem in the Node.js ecosystem", and a library that gives no `code` leaves the message as the only signal. So the rule only reports, with neither a fix nor a suggestion, and its message says to ask the library for a `code`. Where none exists yet, turn the rule off with a directive at that line.

## Examples

Incorrect:

```js
try {
  await fs.promises.readFile("orders.json");
} catch (error) {
  if (error.message.includes("ENOENT")) return [];
  throw error;
}
```

Correct:

```js
try {
  await fs.promises.readFile("orders.json");
} catch (error) {
  if (error.code === "ENOENT") return [];
  throw error;
}
```

## Why there is no autofix

The `code` or class that replaces the message test is defined by the library that throws, not by the caller.
