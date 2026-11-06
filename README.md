# eslint-plugin-clean-code-book

Lint rules from *Clean Code, 2nd Edition*, for ESLint and Oxlint, with fixes that keep what the code does unchanged.

Every rule of `recommended` comes from a passage of the book, and its doc page quotes it. Every report says three things: what is wrong, what the book says about it, and the refactor the book recommends. That makes the reports something a person or a coding agent can act on without looking anything up. Where a rule can fix what it reports without changing how the code behaves, `--fix` does; where no such fix exists, the rule's doc page says why.

- 36 rules of its own, and the built-in rules that check what the book asks of size and shape (function length, parameters, nesting, complexity, file length), all at the book's values.
- One codebase for ESLint and Oxlint: every rule's tests run under both.
- TypeScript, JavaScript, JSX and TSX.
- An opt-in `ai` config, with five more rules for the habits of AI-generated code. It is separate from the book's rules, and `recommended` does not turn it on.
- An opt-in `node` config, with four rules for Node's event loop and error model from the Node books, and a `node-extended` companion that adds `eslint-plugin-n`'s callback-error check.
- An opt-in `react` config, with two rules for React state from the React books, on `.jsx` and `.tsx` files, and a `react-extended` companion that adds the rules of hooks and the list-key rules.

## Requirements

- Node.js 22.18 or later.
- ESLint 10 or later, with flat config, **or** Oxlint 1.92 or later.
- With ESLint: typescript-eslint 8.72.1 or later in 8.x, for `recommended` too, since it parses the TypeScript files. `recommended-type-checked` also needs a `tsconfig.json`.
- With Oxlint: nothing else. Oxlint doesn't need ESLint or typescript-eslint.
- For `node-extended` with ESLint only: `eslint-plugin-n` 17 or later. Nothing else needs it, and Oxlint runs the same rule natively.
- For `react-extended` with ESLint only: `eslint-plugin-react-hooks` 6 or later and `eslint-plugin-react` 7.37 or later. Nothing else needs them, and Oxlint runs the same rules natively.

## Setup with ESLint

Install the plugin, ESLint and typescript-eslint (the TypeScript parser `recommended` uses for `.ts`, `.mts`, `.cts` and `.tsx` files):

```sh
npm install --save-dev eslint-plugin-clean-code-book eslint typescript-eslint
```

Then add `recommended` to `eslint.config.js`:

<!-- setup: eslint -->
```js
import cleanCode from "eslint-plugin-clean-code-book";

export default [...cleanCode.configs.recommended];
```

In a project whose `package.json` does not say `"type": "module"`, name the file `eslint.config.mjs`.

`recommended` applies to `.js`, `.mjs`, `.cjs`, `.jsx`, `.ts`, `.mts`, `.cts` and `.tsx` files. Three rules apply to test files only: `*.test.*`, `*.spec.*` and files under `__tests__/`.

### With type information

`recommended-type-checked` is `recommended` plus five rules that need to know the types of values, such as whether a function named `isReady` returns a boolean. It turns on typescript-eslint's project service for TypeScript files, which reads your `tsconfig.json`:

<!-- setup: eslint-type-checked -->
```js
import cleanCode from "eslint-plugin-clean-code-book";

export default [
  ...cleanCode.configs["recommended-type-checked"],
  {
    files: ["**/*.{ts,mts,cts,tsx}"],
    languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } },
  },
];
```

Type-aware linting is slower, and only ESLint can do it: Oxlint's JavaScript plugins have no type information.

## Setup with Oxlint

Install the plugin and Oxlint. ESLint and typescript-eslint are not needed:

```sh
npm install --save-dev eslint-plugin-clean-code-book oxlint
```

Then extend `recommended` in `oxlint.config.ts`:

<!-- setup: oxlint -->
```ts
import { recommended } from "eslint-plugin-clean-code-book/oxlint";

export default { extends: [recommended] };
```

and run `oxlint -c oxlint.config.ts`. The Oxlint config has the same rules as ESLint's `recommended`, under Oxlint's names, and loads this plugin's rules through `jsPlugins`. The five type-aware rules are not in it.

## The `ai` config

`ai` is an opt-in config of five rules for the habits AI-generated code brings: comments that narrate code which should describe itself, a `catch` that only logs, stub bodies, emoji, and placeholder strings. These rules are not from the book. Each one is justified by the habit and the harm it does, in [`docs/catalog-ai.md`](docs/catalog-ai.md). Every `ai` rule is an `error`, and none has a fix. `/** */` doc comments stay allowed.

`ai` stands alone: add it after `recommended`, or use it on its own. In ESLint:

<!-- setup: eslint-ai -->
```js
import cleanCode from "eslint-plugin-clean-code-book";

export default [...cleanCode.configs.recommended, ...cleanCode.configs.ai];
```

In Oxlint:

<!-- setup: oxlint-ai -->
```ts
import { ai, recommended } from "eslint-plugin-clean-code-book/oxlint";

export default { extends: [recommended, ai] };
```

`ai-no-placeholder-implementation` and `ai-no-placeholder-values` are off in test files, where stubs and sample values belong. `ai-no-ceremonial-catch` can report the book's own pattern, a boundary `catch` that only logs; its [doc page](docs/rules/ai/ai-no-ceremonial-catch.md#where-this-departs-from-the-book) says why, and its `allowSwallow` option keeps that pattern.

## The `node` config

`node` is an opt-in config of four rules for code that runs under Node: a blocking `…Sync()` call in an event or request handler, a function that schedules itself with `process.nextTick()`, a fatal-error handler that logs and keeps the process running, and telling errors apart by their message. These rules are not from *Clean Code*. Each one quotes a passage of *Distributed Systems with Node.js* or *JavaScript: The Definitive Guide*, in [`docs/catalog-node.md`](docs/catalog-node.md). Every `node` rule is an `error`, and none has a fix. `node` needs nothing that `recommended` does not.

Add it after `recommended`. In ESLint:

<!-- setup: eslint-node -->
```js
import cleanCode from "eslint-plugin-clean-code-book";

export default [...cleanCode.configs.recommended, ...cleanCode.configs.node];
```

In Oxlint:

<!-- setup: oxlint-node -->
```ts
import { node, recommended } from "eslint-plugin-clean-code-book/oxlint";

export default { extends: [recommended, node] };
```

### `node-extended`

`node-extended` adds `eslint-plugin-n`'s `n/handle-callback-err`, which reports a Node-style callback that never checks its error argument, named `err` or `error`. It lists that one rule rather than using `eslint-plugin-n`'s presets, and leaves out `n/no-process-exit`, which would report the exit `node-exit-after-fatal-error` asks for, and `n/no-sync`, which would report the startup reads `node-no-sync-in-handler` leaves alone.

With ESLint, install `eslint-plugin-n`, an optional peer dependency that only `node-extended` needs:

```sh
npm install --save-dev eslint-plugin-n
```

and add `node-extended` after `node`:

<!-- setup: eslint-node-extended -->
```js
import cleanCode from "eslint-plugin-clean-code-book";

export default [...cleanCode.configs.recommended, ...cleanCode.configs.node, ...cleanCode.configs["node-extended"]];
```

Oxlint runs the same rule natively, as `node/handle-callback-err`, so nothing more is installed:

<!-- setup: oxlint-node-extended -->
```ts
import { node, nodeExtended, recommended } from "eslint-plugin-clean-code-book/oxlint";

export default { extends: [recommended, node, nodeExtended] };
```

## The `react` config

`react` is an opt-in config of two rules for React components and hooks: a `useState` or `useReducer` value changed in place, and an empty `useState([])` with no type. These rules are not from *Clean Code*. Each one quotes a passage of *Learn React with TypeScript*, in [`docs/catalog-react.md`](docs/catalog-react.md). `react` applies to `.jsx` and `.tsx` files only, so a project that turns it on gets no React rule on its other files. Every `react` rule is an `error`, and none has a fix. `react` needs nothing that `recommended` does not.

`react` changes no rule of `recommended`. A component or a custom hook is a function, and `max-lines-per-function` still limits it to 12 lines, markup included: the React books' remedy for a large component is to split it, as the book's is for a large function. A project that finds 12 lines too few for markup can change that rule for `**/*.{jsx,tsx}`, as [Changing a rule](#changing-a-rule) shows.

Add it after `recommended`. In ESLint:

<!-- setup: eslint-react -->
```js
import cleanCode from "eslint-plugin-clean-code-book";

export default [...cleanCode.configs.recommended, ...cleanCode.configs.react];
```

In Oxlint:

<!-- setup: oxlint-react -->
```ts
import { react, recommended } from "eslint-plugin-clean-code-book/oxlint";

export default { extends: [recommended, react] };
```

### `react-extended`

`react-extended` adds four rules of other plugins, each an `error`: `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps` from `eslint-plugin-react-hooks`, and `react/jsx-key` and `react/no-array-index-key` from `eslint-plugin-react`. It lists them one by one rather than using the plugins' presets, so `exhaustive-deps` is an error, not the preset's warning. The two hooks rules also run on `.js` and `.ts` files whose name starts with `use`, so a custom hook such as `useChecked.ts` is checked; the two `react/` rules run on `.jsx` and `.tsx` files only.

With ESLint, install the two plugins, optional peer dependencies that only `react-extended` needs:

```sh
npm install --save-dev eslint-plugin-react-hooks eslint-plugin-react
```

and add `react-extended` after `react`:

<!-- setup: eslint-react-extended -->
```js
import cleanCode from "eslint-plugin-clean-code-book";

export default [...cleanCode.configs.recommended, ...cleanCode.configs.react, ...cleanCode.configs["react-extended"]];
```

Oxlint runs the same four rules natively, in its `react` plugin, so nothing more is installed. There the hooks rules are named `react/rules-of-hooks` and `react/exhaustive-deps`:

<!-- setup: oxlint-react-extended -->
```ts
import { react, reactExtended, recommended } from "eslint-plugin-clean-code-book/oxlint";

export default { extends: [recommended, react, reactExtended] };
```

Turning on Oxlint's `react` plugin also turns on that plugin's rules in Oxlint's `correctness` category, as warnings, unless your config sets `categories`. `react-extended` itself turns on only the four rules above.

## Changing a rule

Every rule is an `error`, and every threshold is the book's value, or a value the [catalog](docs/catalog.md#thresholds-the-book-does-not-state) gives a reason for. To change one, add your own settings after `recommended`. A setting added this way applies to every file. In ESLint that includes test files, where `recommended` turns `max-lines-per-function` off, so to change that rule, give the entry a `files` or `ignores` of its own.

In ESLint:

<!-- setup: eslint-changed -->
```js
import cleanCode from "eslint-plugin-clean-code-book";

export default [
  ...cleanCode.configs.recommended,
  {
    rules: {
      "max-params": ["error", { max: 4, countThis: "never" }],
      "clean-code-book/no-flag-argument": "warn",
      "clean-code-book/stepdown-order": "off",
    },
  },
];
```

In Oxlint:

<!-- setup: oxlint-changed -->
```ts
import { recommended } from "eslint-plugin-clean-code-book/oxlint";

export default {
  extends: [recommended],
  rules: {
    "max-params": ["error", { max: 4, countThis: "never" }],
    "clean-code-book/no-flag-argument": "warn",
    "clean-code-book/stepdown-order": "off",
  },
};
```

## Fixes

`--fix` applies a rule's fix only where the fix keeps the code doing exactly what it did. Each rule's doc page lists the cases its fix leaves alone; "partial" in the tables below means there are some. A fix never turns an `import type` into a runtime import, never removes a constructor or an overload, and never joins two statements in code written without semicolons. Each fix is tested on its output, on the fixed output reporting nothing more, and, where the code can run, on giving the same results before and after.

The built-in rules keep their own behaviour, including the fixes some of them have. The fixes that `no-unused-vars` offers for unused imports and variables are turned off, because they can remove an import that has side effects.

## Rules

Each book rule's page quotes the passage it comes from, each `ai` rule's page names the AI pattern and its harm, each `node` rule's page quotes its Node book, and each `react` rule's page quotes its React book. Every page says what the rule reports, what it leaves alone, and how its fix works or why it has none.

### In `recommended`

| Rule | What it checks | Fix |
| --- | --- | --- |
| [`error-handling-is-one-thing`](docs/rules/error-handling-is-one-thing.md) | A function that handles errors does nothing else: its `try` comes first and nothing follows the `catch` or `finally`. | no |
| [`fields-first`](docs/rules/fields-first.md) | Declare a class's fields together, above its constructor, methods and accessors. | partial |
| [`loop-variable-in-loop`](docs/rules/loop-variable-in-loop.md) | Declare a loop's control variable in the loop statement instead of before it. | partial |
| [`max-block-statements`](docs/rules/max-block-statements.md) | Keep the blocks inside `if`, `else`, loops, `try`, `catch` and `finally` to one or two statements. | no |
| [`name-length-matches-scope`](docs/rules/name-length-matches-scope.md) | Use one-letter names only for local variables in very short scopes. | no |
| [`no-attribution-comments`](docs/rules/no-attribution-comments.md) | Delete bylines and `@author` tags; version control records who changed what. | partial |
| [`no-command-query-mix`](docs/rules/no-command-query-mix.md) | A function used as a condition either answers something or does something, not both. | no |
| [`no-commented-out-code`](docs/rules/no-commented-out-code.md) | Delete commented-out code; version control keeps it. | yes |
| [`no-complex-condition`](docs/rules/no-complex-condition.md) | Extract a condition that mixes `&&` and `\|\|`, or joins more than three operands, into a named predicate. | no |
| [`no-encodings`](docs/rules/no-encodings.md) | Leave type and scope encodings out of names: no `m_` member prefix, no Hungarian `str`/`sz` prefix, no `I` on interfaces. | partial |
| [`no-flag-argument`](docs/rules/no-flag-argument.md) | Don't pass a boolean flag into a function: it says the function does more than one thing. | partial |
| [`no-getter-chains`](docs/rules/no-getter-chains.md) | Do not chain getter calls through the objects a getter returns. | no |
| [`no-html-in-comments`](docs/rules/no-html-in-comments.md) | Write comments as plain text, without HTML tags or entities. | partial |
| [`no-hybrid-class`](docs/rules/no-hybrid-class.md) | A class is either an object (hidden data, public behaviour) or a data structure (public data, no behaviour), not both. | no |
| [`no-journal-comments`](docs/rules/no-journal-comments.md) | Delete change-log comments; version control keeps the history. | yes |
| [`no-mutable-static-state`](docs/rules/no-mutable-static-state.md) | Methods share state through instance fields, not through static fields they assign. | no |
| [`no-noise-words`](docs/rules/no-noise-words.md) | Leave noise words out of names: `variable`, a suffix that repeats the declared type, and `Manager`, `Processor`, `Data` or `Info` in class names. | no |
| [`no-number-series-names`](docs/rules/no-number-series-names.md) | Make meaningful distinctions: no bindings in one scope that differ only by a trailing number (`list1`, `list2`). | no |
| [`no-overloaded-constructors`](docs/rules/no-overloaded-constructors.md) | Use named static factory methods instead of overloaded constructors. | no |
| [`no-position-markers`](docs/rules/no-position-markers.md) | Remove banner comments made of long runs of punctuation. | yes |
| [`no-protected-fields`](docs/rules/no-protected-fields.md) | Avoid `protected` fields: they let code in other files, in subclasses, depend on a class's variables. | no |
| [`no-pure-delegator`](docs/rules/no-pure-delegator.md) | Don't extract the whole body of a function into another one, leaving a function that only passes its parameters on. | partial |
| [`no-redundant-comments`](docs/rules/no-redundant-comments.md) | Delete doc comments and `@param` tags that only restate the name. | yes |
| [`no-side-effects-in-predicates`](docs/rules/no-side-effects-in-predicates.md) | A function named as a predicate (`is…`, `has…`, `can…`, `should…`) must not assign to anything declared outside it. | no |
| [`no-trivial-accessors`](docs/rules/no-trivial-accessors.md) | Do not push private fields out through trivial getters: hide the implementation behind an abstraction. | no |
| [`one-switch-per-type`](docs/rules/one-switch-per-type.md) | Switch at most once on a class's own type code. | no |
| [`return-boolean-directly`](docs/rules/return-boolean-directly.md) | Return a boolean expression directly instead of branching to `return true` and `return false`. | yes |
| [`stepdown-order`](docs/rules/stepdown-order.md) | Declare a function below the first function that calls it, so the code reads top to bottom (the Stepdown Rule). | partial |

### In `recommended`, for test files only

| Rule | What it checks | Fix |
| --- | --- | --- |
| [`no-disabled-tests`](docs/rules/no-disabled-tests.md) | Don't turn failing tests off; a test that must stay off carries its reason in a comment. | no |
| [`no-shared-test-state`](docs/rules/no-shared-test-state.md) | A test does not assign variables declared outside it, so no test sets up the conditions for the next. | no |
| [`test-asserts`](docs/rules/test-asserts.md) | Every test asserts, so it passes or fails by itself. | no |

### In `recommended-type-checked` only

| Rule | What it checks | Fix |
| --- | --- | --- |
| [`law-of-demeter`](docs/rules/law-of-demeter.md) | Do not call methods on objects returned by other method calls: talk to friends, not to strangers. | no |
| [`no-concrete-inheritance`](docs/rules/no-concrete-inheritance.md) | Do not extend a concrete class of the project, and do not override its concrete methods. | no |
| [`no-container-in-name`](docs/rules/no-container-in-name.md) | Do not end a name in `List`, `Array`, `Map` or `Set` unless the value is that kind of container. | no |
| [`no-subtype-check`](docs/rules/no-subtype-check.md) | Do not test whether a value is a particular subtype of its declared type. | no |
| [`predicate-returns-boolean`](docs/rules/predicate-returns-boolean.md) | A function named as a question (`is`, `has`, `can`, `should`) returns a boolean. | no |

`no-command-query-mix` is in `recommended`; `recommended-type-checked` also turns on its `checkMethodCalls` option.

### In `ai`

| Rule | What it checks | Fix |
| --- | --- | --- |
| [`ai-no-ceremonial-catch`](docs/rules/ai/ai-no-ceremonial-catch.md) | Don't catch an error only to log it and rethrow it, or only to log it and carry on. | no |
| [`ai-no-emoji`](docs/rules/ai/ai-no-emoji.md) | Keep emoji out of comments, strings and log messages. | no |
| [`ai-no-inline-comments`](docs/rules/ai/ai-no-inline-comments.md) | Say it in the code, not in a `//` or `/* */` comment: only `/** */` doc comments and tool directives stay. | no |
| [`ai-no-placeholder-implementation`](docs/rules/ai/ai-no-placeholder-implementation.md) | Don't ship a function whose body is only a placeholder: `throw new Error("Not implemented")` or a stub return. | no |
| [`ai-no-placeholder-values`](docs/rules/ai/ai-no-placeholder-values.md) | Don't leave placeholder strings such as `"YOUR_API_KEY"` or `"<insert token>"` in the code. | no |

### In `node`

| Rule | What it checks | Fix |
| --- | --- | --- |
| [`node-exit-after-fatal-error`](docs/rules/node/node-exit-after-fatal-error.md) | A handler for an uncaught exception or an unhandled rejection ends the process; it does not log the error and carry on. | no |
| [`node-no-error-message-matching`](docs/rules/node/node-no-error-message-matching.md) | Tell errors apart by their `code` or their class, not by matching the text of their message. | no |
| [`node-no-recursive-next-tick`](docs/rules/node/node-no-recursive-next-tick.md) | Don't break work up by having a function schedule itself again with `process.nextTick()`. | no |
| [`node-no-sync-in-handler`](docs/rules/node/node-no-sync-in-handler.md) | Don't call a blocking `…Sync()` function inside an event handler or a server's request handler. | no |

### In `node-extended`

| Rule | Setting | Catalog entry |
| --- | --- | --- |
| `n/handle-callback-err` | `^(err\|error)$`; `node/handle-callback-err` in Oxlint | NODE-08 |

### In `react`

| Rule | What it checks | Fix |
| --- | --- | --- |
| [`react-no-state-mutation`](docs/rules/react/react-no-state-mutation.md) | Don't mutate a value from `useState` or `useReducer`; pass a new value to its setter. | no |
| [`react-no-untyped-empty-state`](docs/rules/react/react-no-untyped-empty-state.md) | Give `useState([])` a type argument in a `.tsx` file, so the state is not an array of `any`. | no |

### In `react-extended`

| Rule | Files | Oxlint | Catalog entry |
| --- | --- | --- | --- |
| `react-hooks/rules-of-hooks` | `.jsx`, `.tsx`, and `use*.js`, `use*.ts` | `react/rules-of-hooks` | RCT-01 |
| `react-hooks/exhaustive-deps` | `.jsx`, `.tsx`, and `use*.js`, `use*.ts` | `react/exhaustive-deps` | RCT-02, RCT-03 |
| `react/jsx-key` | `.jsx`, `.tsx` | `react/jsx-key` | RCT-04 |
| `react/no-array-index-key` | `.jsx`, `.tsx` | `react/no-array-index-key` | RCT-04 |

### Built-in rules

`recommended` also turns on these built-in rules, under ESLint and under Oxlint. A threshold is the book's value, or one the catalog gives a reason for (`complexity` is one):

| Rule | Setting | Catalog entry |
| --- | --- | --- |
| `max-params` | 3, not counting a TypeScript `this` parameter | FN-04 |
| `max-lines-per-function` | 12, without blank lines and comments; off in test files | FN-01 |
| `max-depth` | 2 | FN-03 |
| `complexity` | 15 | FN-02 |
| `max-lines` | 500 | FMT-01 |
| `max-classes-per-file` | 1 | CLS-01 |
| `no-else-return` | `allowElseIf: false` | CD-02 |
| `no-unneeded-ternary` | on | CD-01 |
| `no-labels` | on | FH-12 |
| `no-warning-comments` | terms `todo` and `fixme` | CMT-10 |
| `no-param-reassign` | `props: true`, except `acc` and `accumulator` | FH-03 |
| `no-fallthrough` | on | CLS-05 |
| `no-unreachable` | on | HRM-01 |
| `no-unused-vars` | fixes off; `@typescript-eslint/no-unused-vars` in TypeScript under ESLint | HRM-01 |
| `no-empty` | `allowEmptyCatch: false` | FH-08 |
| `id-denylist` | `l`, `O`, `I`, `klass`, `clazz` | NAM-06, NAM-07 |
| `@typescript-eslint/prefer-for-of` | on; `typescript/prefer-for-of` in Oxlint | CD-04 |

## The catalog

[`docs/catalog.md`](docs/catalog.md) is the record of how the book became these rules. It lists every rule, heuristic and smell in the book with the passage it comes from, and says whether it is checked from syntax, needs type information, is covered by a built-in rule, or cannot be linted, and why. Rules that cannot be linted, such as "one level of abstraction per function", are not in this plugin. The `ai` config's rules have a catalog of their own, [`docs/catalog-ai.md`](docs/catalog-ai.md), and so do the `node` config's, [`docs/catalog-node.md`](docs/catalog-node.md), and the `react` config's, [`docs/catalog-react.md`](docs/catalog-react.md).

## Contributing

[`CONTRIBUTING.md`](CONTRIBUTING.md) explains how a rule is written and tested.

## License

[Apache-2.0](LICENSE)
