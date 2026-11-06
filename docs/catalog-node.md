# Catalog: the `node` config, practices of Node's event loop and error model

This catalog is the specification for the rules of the opt-in `node` config. No rule is written until this catalog is approved. It is separate from [`docs/catalog.md`](catalog.md) (*Clean Code, 2nd Edition*), [`docs/catalog-ai.md`](catalog-ai.md) (the habits of AI-generated code) and [`docs/catalog-typescript.md`](catalog-typescript.md) (the TypeScript type system and JavaScript, including promises). Its entries come from the Node books in the bookCTX library: *Distributed Systems with Node.js*, and chapter 16, "Server-Side JavaScript with Node", of *JavaScript: The Definitive Guide*. The `node` config applies to the same files as `recommended` (`ALL_FILES` in `src/configs.ts`); a project turns it on for the code that runs under Node. It stacks on `recommended` the way `ai` does: `[...recommended, ...node]`. `recommended` is unchanged by it. ADR 0001 of A11-415 records why the practices are split into per-language configs, each with an `-extended` companion.

Each entry gives:

- **Source**: the book, by its bookCTX slug, the chunk, and the section the passage sits under. `distributed-systems-with-node-js chunk 21` means `get_chunk(book_slug="distributed-systems-with-node-js", chunk=21)`.
- **Quote**: the passage, copied verbatim from that chunk, including the extraction's own spacing before punctuation (for example "`setImmediate()` .").
- **Class**: one of seven.
  - **syntax**: a custom rule, named `node-<name>`, that needs only the syntax tree and scope analysis. It runs under ESLint and Oxlint, and goes in `node`.
  - **types**: a custom rule that needs type information. It runs under ESLint only, and goes in `node-type-checked`. No entry here needs one, so this catalog proposes no `node-type-checked`.
  - **built-in**: a rule ESLint core already has, that Oxlint also runs natively. It goes in `node` as configuration only.
  - **third-party**: a rule another plugin already has (`eslint-plugin-n`). The entry names the plugin and the rule, and says whether Oxlint runs it natively. It goes in the [`node-extended`](#extended-configs) companion only. The plain `node` config never turns it on, so it adds no peer dependency.
  - **covered**: a rule in `recommended` or `ai` already checks it. The entry names that rule and its entry.
  - **conflicts**: the practice clashes with a rule of `recommended` or `ai`. [Conflicts with `recommended` and `ai`](#conflicts-with-recommended-and-ai) gives one resolution.
  - **not lintable**: the reason is given.
- **Rule**, **Reports**, **Does not report** and **Fix**: for each `syntax` entry. **Rule** and **Setting** for each `third-party` entry.

Every rule this catalog proposes is set to `error`, as in the rest of the plugin.

The books quoted:

| Slug | Book |
| --- | --- |
| `distributed-systems-with-node-js` | *Distributed Systems with Node.js*, Thomas Hunter II |
| `javascript-the-definitive-guide` | *JavaScript: The Definitive Guide*, David Flanagan, chapter 16 |

## What the owner is asked to approve

Approving this pull request approves the items below.

1. **The entries and their classes**, NODE-01 to NODE-10, as listed in [The rule set at a glance](#the-rule-set-at-a-glance): four custom `syntax` rules (NODE-01, NODE-03, NODE-04, NODE-06), one `third-party` (NODE-08), one `covered` (NODE-09) and four `not lintable` (NODE-02, NODE-05, NODE-07, NODE-10).
2. **Where the two Node books disagree.** NODE-04 follows *Distributed Systems with Node.js*, which says a process must not go on after an uncaught exception or rejection, over *JavaScript: The Definitive Guide*, which shows a global handler that logs and keeps the process alive. The entry gives the reason.
3. **The conflict resolutions** in [Conflicts with `recommended` and `ai`](#conflicts-with-recommended-and-ai): NODE-04 is kept, and `node-extended` leaves out the `no-process-exit` rules that would fight it.
4. **Choices the books do not state.** Each is marked **Owner sign-off** in its entry: NODE-01 (which calls count as a handler), NODE-06 (report-only, since the book says there is no perfect alternative) and NODE-08 (the callback-error name pattern).
5. **The extended config and its final name.** `node-extended`, listed in [Extended configs](#extended-configs). `-extended` is a working name, not an established ecosystem suffix; the owner chooses the final suffix, the same for all three languages.
6. **New optional peer dependency.** `eslint-plugin-n`, `optional: true`, needed by `node-extended` only.
7. **Custom rules without an autofix.** NODE-01, NODE-03, NODE-04 and NODE-06 have none; each entry says why.
8. **Quotations in a public repository.** The quoted passages are the publishers' text. About 12 short passages appear here, each with a citation and used for commentary. As with `catalog.md` (its item 7), the owner decides before merging whether they stay, or whether the catalog keeps only the citations.

## The rule set at a glance

| Rule | Entry | Config | Class | Fix |
| --- | --- | --- | --- | --- |
| `node-no-sync-in-handler` | NODE-01 | node | syntax | no fix |
| — | NODE-02 | — | not lintable | — |
| `node-no-recursive-next-tick` | NODE-03 | node | syntax | no fix |
| `node-exit-after-fatal-error` | NODE-04 | node | syntax | no fix |
| — | NODE-05 | — | not lintable | — |
| `node-no-error-message-matching` | NODE-06 | node | syntax | no fix |
| — | NODE-07 | — | not lintable | — |
| `n/handle-callback-err` | NODE-08 | node-extended | third-party | none |
| `ai-no-placeholder-values` | NODE-09 | ai | covered (AI-05) | — |
| — | NODE-10 | — | not lintable | — |

## Entries

### The event loop

#### NODE-01 · Keep event handlers non-blocking

- **Source:** `javascript-the-definitive-guide` chunk 54, § 16.4 Events and EventEmitter.
- **Quote:** "If you write an event handler that calls a blocking function like `fs.readFileSync()` , no further event handling will happen until your synchronous file read is complete. If your program is one-like a network server-that needs to be responsive, then it is important that you keep your event handler functions nonblocking and fast."
- **Class:** syntax. `eslint-plugin-n`'s `n/no-sync` (Oxlint: `node/no-sync`) reports every `…Sync()` call, including a configuration file read once at startup, which the book does not object to. This rule reports only the case the book names.
- **Rule:** `node-no-sync-in-handler`.
- **Reports:** a call of a member whose name ends in `Sync` (`fs.readFileSync`, `crypto.pbkdf2Sync`, `child_process.execSync`) inside a function, at any depth of nesting, that is passed as an argument to:
  - `.on(…)`, `.once(…)`, `.addListener(…)`, `.prependListener(…)` or `.prependOnceListener(…)`, the `EventEmitter` methods;
  - `http.createServer(…)`, `https.createServer(…)` or `net.createServer(…)`, whose argument is a `request` or `connection` handler.
- **Does not report:** a `…Sync()` call at module top level or in a function that is not passed as a handler (startup code); a call whose name merely ends in `sync`, lowercase (`rsync`). **Owner sign-off** on the list of handler-taking calls: framework routers (`app.get(path, handler)`) are left out, because a rule cannot tell them from other calls by syntax alone.
- **Fix:** no fix. The asynchronous replacement changes the handler into one that awaits or takes a callback, and the code after the call moves with it.

#### NODE-02 · Don't starve the event loop with CPU-heavy work

- **Source:** `distributed-systems-with-node-js` chunk 2, § Event Loop Tips.
- **Quote:** "*Don't starve the event loop.* Running too much code in a single stack will stall the event loop and prevent other callbacks from firing. One way to fix this is to break CPU-heavy operations up across multiple stacks."
- **Class:** not lintable. How long a loop runs depends on its data, which a static rule does not see.

#### NODE-03 · Never break work up with a recursive `process.nextTick()`

- **Source:** `distributed-systems-with-node-js` chunk 2, § Event Loop Tips.
- **Quote:** "You should never break up such work using `process.nextTick()` . Doing so will lead to a microtask queue that never empties-your application will be trapped in the same phase forever!"
- **Class:** syntax.
- **Rule:** `node-no-recursive-next-tick`.
- **Reports:** a call `process.nextTick(f)` made inside the body of `f` itself, where `f` is the name of the enclosing function declaration, named function expression or `const` function; and `process.nextTick(arguments.callee)`.
- **Does not report:** a `process.nextTick(f)` whose `f` is a different function; `setImmediate(f)` inside `f`, which is the book's recommended way to break up work ("using `setImmediate()` at the end of each batch to continue processing the next batch").
- **Fix:** no fix. `setImmediate` is the book's remedy, but it runs `f` in a later phase of the event loop, which changes the order in which other callbacks run.

### Errors

#### NODE-04 · Do not keep running after an uncaught exception or rejection

- **Source:** `distributed-systems-with-node-js` chunk 21, § Warning; `javascript-the-definitive-guide` chunk 53, § 16.1.3 Program Life Cycle.
- **Quote (`distributed-systems-with-node-js` chunk 21):** "Much like with the `uncaughtException` event, it's important to not allow the process to continue running since it is likely in an invalid state."
- **Quote (`javascript-the-definitive-guide` chunk 53):** "In some future version of Node, unhandled Promise rejections are expected to become fatal errors."
- **Class:** syntax.
- **Rule:** `node-exit-after-fatal-error`.
- **Reports:** a handler passed to `process.on(…)` or `process.once(…)` for `"uncaughtException"` or `"unhandledRejection"`, and a callback passed to `process.setUncaughtExceptionCaptureCallback(…)`, whose body has no path that ends the process: no call of `process.exit(…)` or `process.abort()`, no assignment to `process.exitCode`, and no `throw`.
- **Does not report:** a handler that does any of those, including one that logs first and then exits; a handler for any other event.
- **Where the books disagree:** *JavaScript: The Definitive Guide* registers a handler "If you don't want these exceptions to cause your program to completely crash", and its example only logs (chunk 53). This entry follows *Distributed Systems with Node.js* because the guide itself expects rejections to become fatal, and because a log-only handler is the process-wide form of the log-and-swallow habit that AI-02 (`ai-no-ceremonial-catch`) reports in a `catch` clause. **Owner approval**, item 2.
- **Fix:** no fix. How the process should end (exit at once, or close servers first) is the program's decision.

#### NODE-05 · An `EventEmitter`'s `error` event needs a listener

- **Source:** `distributed-systems-with-node-js` chunk 21, § Warning.
- **Quote:** "Instances of `EventEmitter` that emit an `error` event without having a listener will cause the process to terminate."
- **Class:** not lintable. Whether a value is an emitter, and whether a listener is attached to it, depends on code in other files: emitters are created in one module and listened to in another, and a stream gets its `error` listener from `pipeline()`. A rule of one file would report every emitter it cannot follow.

#### NODE-06 · Tell errors apart by `code` or class, not by their message

- **Source:** `distributed-systems-with-node-js` chunk 21, § Exceptions, Rejections, and Emitted Errors.
- **Quote:** "The most common approach for targeting specific errors is to parse the actual `.message` field. When doing this, your application will need to inspect text meant for human consumption-for example, using `e.message.startsWith('Had to fallback')` . This is unfortunately quite error prone!"
- **Class:** syntax.
- **Rule:** `node-no-error-message-matching`.
- **Reports:** inside a `catch` clause, or a `.catch(…)` callback, on its error parameter `e`: `e.message.startsWith(…)`, `.endsWith(…)`, `.includes(…)`, `.indexOf(…)`, `.match(…)` and `.search(…)`; `e.message === …`, `!==`, `==` and `!=`; and `<regexp>.test(e.message)`.
- **Does not report:** reading `e.message` to log it or to put it in a new error; `e.code === …` and `e instanceof …`, which are the book's alternatives.
- **Owner sign-off:** the book adds that "there's currently no perfect solution to the error-differentiation problem in the Node.js ecosystem", and a library that gives no `code` leaves the message as the only signal. The rule reports, and the message says to ask the library for a `code`; a project turns it off with a directive at that call.
- **Fix:** no fix. The `code` that replaces the message test is defined by the library that throws, not by the caller.

#### NODE-07 · Give the errors a package throws a class or a `code`

- **Source:** `distributed-systems-with-node-js` chunk 21, § Exceptions, Rejections, and Emitted Errors.
- **Quote:** "As a package author, always be intentional with the errors you provide and try to export error subclasses or provide a `.code` property."
- **Class:** not lintable. Which `throw` reaches a package's callers depends on its public API across files, and a plain `new Error(…)` thrown and caught inside the package is fine.

#### NODE-08 · Check the error argument of a Node-style callback

- **Source:** `distributed-systems-with-node-js` chunk 21, § Warning.
- **Quote:** "Node.js was built with the callback pattern in mind for asynchronous activities, having the first argument of the callback be an error."
- **Class:** third-party. `eslint-plugin-n` `n/handle-callback-err`. Oxlint runs it natively as `node/handle-callback-err` (checked with Oxlint 1.92.0 on 2026-11-06: it reports `fs.readFile("x", (err, data) => { console.log(data); })`).
- **Setting:** `["error", "^(err|error)$"]`. **Owner sign-off:** the plugin's default matches only `err`; the pattern adds `error`.

### Configuration

#### NODE-09 · Keep configuration out of the code

- **Source:** `distributed-systems-with-node-js` chunk 29, § Environment Variables.
- **Quote:** "The best way to keep configuration out of an application's codebase is to provide such values via environment variables. This way, a compromised code repository shouldn't lead to sensitive data being stolen."
- **Class:** covered, for the part a rule can see. AI-05 (`ai-no-placeholder-values`) in `ai` reports a value left in the code for a person to fill in (`"YOUR_API_KEY"`, `"changeme"`); its entry says the real value belongs in configuration: "The real value is not in the code, and reading it from configuration is a change to how the program starts." A real connection string or credential written in the code is not reported by any rule here; `catalog-ai.md`'s "Not in this config" sends hardcoded credentials to a secret scanner, and this catalog follows it.

#### NODE-10 · Environment variables are read once, at startup

- **Source:** `distributed-systems-with-node-js` chunk 29, § Environment Variables.
- **Quote:** "Environment variables are set once, before an application first runs, and are then considered static throughout the lifetime of the process. Any values that need to be changed dynamically require a different tool to access the configuration values"
- **Class:** not lintable. Reading `process.env` inside a request handler is not wrong in itself; the book's point is about which values belong in the environment, which is a decision about the deployment.

## Conflicts with `recommended` and `ai`

No `node` entry clashes with a rule of `recommended` or `ai`. The clashes found are with third-party rules the `node-extended` config would otherwise take, and with the TypeScript catalog's book:

1. **NODE-04 against `no-process-exit`.** `eslint-plugin-n` has `n/no-process-exit`, and Oxlint has `unicorn/no-process-exit` (listed by `oxlint --rules`; Oxlint has no `node/no-process-exit`). Either would report the `process.exit(1)` that NODE-04 asks for. **Resolution: drop the third-party rule.** `node-extended` lists its rules one by one and leaves both out; it does not use `eslint-plugin-n`'s presets.
2. **NODE-01 against `n/no-sync`.** `n/no-sync` reports startup reads that NODE-01 leaves alone, so the two would disagree on the same file. **Resolution: drop the third-party rule.** `node-extended` leaves `n/no-sync` out, and NODE-01 is the `node` config's check for blocking calls.
3. **NODE-04 and `catalog-typescript.md`'s TS-12.** Both books' examples log an error and carry on, once in a `.catch()` and once in a process handler. `catalog-typescript.md` drops its entry in favour of AI-02, and NODE-04 reports the process-wide case, so the three catalogs agree.

Checked, no clash:

- **NODE-06 against FH-07 (`error-handling-is-one-thing`).** FH-07 is about what else a function with a `try` does; NODE-06 is about one expression inside the `catch`. A `catch` that tests `e.code` instead of `e.message` is the same shape for FH-07.
- **NODE-04 against AI-02 (`ai-no-ceremonial-catch`).** AI-02 checks `catch` clauses, NODE-04 checks `process` handlers; no code is reported by both.
- **NODE-08 against `max-params` (FN-04).** An error-first callback has two or three parameters, within FN-04's limit of 3.

## Gaps

These are topics the plan expects *Node.js Design Patterns* (Mario Casciaro and Luciano Mammino) to ground, and that the library could not ground in this run. No entry is written for them from memory.

How the library was searched: bookCTX allowed three `search_library` calls in this run. The Node call (tag `backend`) asked six questions. Five came back with the passages used above. One came back with nothing from a Node book:

- **Graceful shutdown on `SIGTERM`**, and exiting after an uncaught exception in a way that lets in-flight requests finish. The question "process exit on uncaught exception and graceful shutdown on SIGTERM" returned a single passage from *Test-Driven Development with Python* about a CI build, and nothing from *Distributed Systems with Node.js* or the guide's chapter 16. NODE-04 says that the process must end; how it should end is this gap.

Topics not reachable in the search budget, whose coverage in the library is unknown rather than shown to be none, and which the follow-up ticket searches before the book arrives:

- a function that calls its callback sometimes synchronously and sometimes asynchronously;
- stream back-pressure, and `pipeline()` against `.pipe()` for error handling;
- module-level singletons and dependency injection in Node modules;
- CommonJS and ES module interoperation.

**Recorded in bookCTX:** not yet. This run's machine refuses `search_oreilly` and `request_book` (its connectors allow only the read tools), so the request is left for the person's session. The pull request gives the exact call, with this reason: "The library's Node sources (Distributed Systems with Node.js, JavaScript: The Definitive Guide ch. 16) ground the event loop, uncaught exceptions and rejections, error codes and environment configuration, but a search for graceful shutdown on SIGTERM returned nothing from a Node book; also unsearched: mixed sync/async callbacks, stream back-pressure and pipeline(), module singletons and dependency injection, CJS/ESM interop. catalog-node.md lists these as gaps."

## Extended configs

`node-extended` turns on the `third-party` entry. It applies to `ALL_FILES` like `node`, and stacks on it: `[...recommended, ...node, ...nodeExtended]`. It needs no type information, so there is no `node-extended-type-checked`.

### `node-extended`

| Rule | Setting | Files | Entry |
| --- | --- | --- | --- |
| `n/handle-callback-err` | `["error", "^(err\|error)$"]` | `ALL_FILES` | NODE-08 |

Left out on purpose: `n/no-process-exit` (Conflicts, item 1) and `n/no-sync` (Conflicts, item 2). `eslint-plugin-n`'s presets are not used, so no rule is turned on that no entry here grounds.

### Optional peer dependencies

The pattern is `package.json`'s `peerDependenciesMeta`, where `eslint`, `oxlint` and `typescript-eslint` are already `optional: true`.

- `eslint-plugin-n`: new, `optional: true`. Its version range is set by the build ticket.

### Oxlint mapping

The Oxlint export of `node-extended` uses Oxlint's native `node` plugin (`plugins: ["node"]`) and loads no JS plugin.

| ESLint rule | Oxlint | Note |
| --- | --- | --- |
| `n/handle-callback-err` | `node/handle-callback-err` | native, checked with the pattern `"^(err\|error)$"` |

"Checked" means: run with Oxlint 1.92.0, the version this repository pins, on 2026-11-06, against a file with the case in it. `eslint-plugin-n` is not installed in this repository, so its behaviour on the same case is checked by the build ticket.
