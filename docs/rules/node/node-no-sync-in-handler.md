# clean-code-book/node-no-sync-in-handler

Don't call a blocking `…Sync()` function inside an event handler or a server's request handler.

- **Config:** `node`
- **Fix:** no
- **Catalog entry:** NODE-01 in [`docs/catalog-node.md`](../../catalog-node.md)

## What the book says

> "If you write an event handler that calls a blocking function like `fs.readFileSync()` , no further event handling will happen until your synchronous file read is complete. If your program is one-like a network server-that needs to be responsive, then it is important that you keep your event handler functions nonblocking and fast."

*JavaScript: The Definitive Guide*, David Flanagan, § 16.4 Events and EventEmitter (bookCTX `javascript-the-definitive-guide` chunk 54).

## What it reports

A call of a member whose name ends in `Sync`, with a capital S (`fs.readFileSync`, `crypto.pbkdf2Sync`, `child_process.execSync`), inside a function, at any depth of nesting, that is passed as an argument to:

- `.on(…)`, `.once(…)`, `.addListener(…)`, `.prependListener(…)` or `.prependOnceListener(…)`, the `EventEmitter` methods;
- `http.createServer(…)`, `https.createServer(…)` or `net.createServer(…)`, whose argument is a `request` or `connection` handler.

The handler can be written in place, or passed by the name of a function declaration or of a `const` set to a function in the same file.

It does not report:

- a `…Sync()` call at module top level, or in a function that is not passed as a handler: startup code, such as reading a configuration file once, which the book does not object to;
- a call whose name merely ends in `sync`, lowercase (`rsync`);
- a handler passed to a framework router (`app.get(path, handler)`): a rule cannot tell a router from any other call by syntax alone, so these are left out (the catalog's owner sign-off);
- a `…Sync` function imported by name and called on its own (`readFileSync(…)`): the entry names member calls only.

`eslint-plugin-n`'s `n/no-sync` reports every `…Sync()` call, startup reads included; `node-extended` leaves it out, and this rule is the `node` config's check for blocking calls.

## Examples

Incorrect:

```js
http.createServer((req, res) => {
  res.end(fs.readFileSync("orders.json"));
});

emitter.on("data", () => {
  fs.appendFileSync("events.log", "data\n");
});
```

Correct:

```js
const template = fs.readFileSync("template.html", "utf8");

http.createServer(async (req, res) => {
  res.end(await fs.promises.readFile("orders.json"));
});
```

## Why there is no autofix

The asynchronous replacement turns the handler into one that awaits or takes a callback, and the code after the call moves with it. That changes when the rest of the handler runs, which is the program's decision.
