# Writing a rule

Every rule in this plugin comes from an entry of [`docs/catalog.md`](docs/catalog.md). The catalog entry is the specification: what the rule reports, what it leaves alone, its threshold, and exactly when its fix applies. A rule does what its entry says, no more and no less. If the entry is wrong or impossible to build as written, change the catalog in the same pull request and say why.

## A rule for `ai` or for `recommended`

A rule earns a place in `recommended` with a passage of the book: its entry in `docs/catalog.md` quotes it. A rule earns a place in the opt-in `ai` config with an AI pattern and its harm instead: a habit that AI-generated code shows, and what that habit costs the people who maintain the code. Its entry goes in [`docs/catalog-ai.md`](docs/catalog-ai.md) (ADR 0001), and has:

- an **AI pattern** line and a **Harm** line;
- a **Language basis** line: *universal*, or *JS/TS-specific*, with the reason;
- a book passage only where one supports it; it is not required.

An `ai` rule is named `ai-<name>`, lives in `src/rules/ai/`, is built with `defineAiRule` instead of `defineRule`, and its page is `docs/rules/ai/<rule>.md`. Its messages name the pattern and its harm where a book rule's name the passage. Its page has `## The AI pattern` (with the **Language basis** line) in place of `## What the book says`, and a rule that contradicts a book example has a `## Where this departs from the book` section that explains why. Add it to `AI_RULES` in `src/configs.ts`, which builds the `ai` config for both linters, and to the README's "In `ai`" table.

## A rule for `node`

A rule earns a place in the opt-in `node` config with a passage of a Node book instead of *Clean Code*: its entry in [`docs/catalog-node.md`](docs/catalog-node.md) quotes *Distributed Systems with Node.js* or *JavaScript: The Definitive Guide* (ADR 0004 of A11-415). Its class is `syntax`: a custom rule that needs only the syntax tree and scope analysis, and runs under both linters.

A `node` rule is named `node-<name>`, lives in `src/rules/node/`, is built with `defineNodeRule` instead of `defineRule`, and its page is `docs/rules/node/<rule>.md`. `defineNodeRule` takes a `source` (the entry, the book's title, the section and a short verbatim passage) where `defineRule` takes `book`, and writes each message as *problem, then the Node book's passage, then the refactor*. A `node` rule reports only: like an `ai` rule, it has no `fixable`. Its page has the same sections as a book rule's, with `## What the book says` quoting the Node book, and `## Why there is no autofix`. The helpers in `src/rules/node/node-calls.ts` read a call's method and receiver and resolve a function passed by name. Add the rule to `NODE_RULES` in `src/configs.ts`, which builds the `node` config for both linters, and to the README's "In `node`" table.

A `third-party` entry of the catalog is configuration, not a rule: it goes in `NODE_EXTENDED_RULES` in `src/configs.ts`, which builds the ESLint `node-extended` config, and its native Oxlint name goes in `nodeExtended` in `src/oxlint.ts`. List each rule one by one; never turn on a plugin's preset. The plugin it comes from is an optional peer dependency, loaded only when `node-extended` is read, so the plain `node` config never needs it.

## Setup

```sh
pnpm install
pnpm test        # builds, then runs every test under ESLint and Oxlint
pnpm typecheck
pnpm lint
```

Run one rule's tests with `pnpm exec rstest run src/rules/<rule>.test.ts`.

## The four files of a rule

| File | What it holds |
| --- | --- |
| `src/rules/<rule>.ts` | the rule, built with `defineRule` |
| `src/rules/<rule>.test.ts` | its cases, run with `runRuleTests` (or `runTypedRuleTests` for a type-aware rule) |
| `docs/rules/<rule>.md` | its doc page |
| `src/rules/index.ts` | one line that registers it |

### The rule

`defineRule` (in `src/lib/define-rule.ts`) takes the rule's name, its catalog entry, the book passage and one `{ problem, refactor }` pair per message. It writes every message as *problem, then the book passage, then the refactor the book recommends*, so an agent reading a report knows what is wrong, why, and what to do. `problem` may use `{{placeholders}}`.

Rules are written once, against the rule API that ESLint and Oxlint share (ADR 0002). In practice:

- Use only `context.sourceCode` (`getText`, `getTokenBefore`/`After`, `getAllComments`, `getCommentsBefore`/`After`, `getScope`, `getDeclaredVariables`, `scopeManager`, `lines`, `text`, `ast`), `context.options`, `context.filename` and `context.report`.
- Never use `context.getSourceCode()`, `context.parserServices` (except in a type-aware rule), `context.languageOptions`, code paths (`onCodePathStart` and friends) or `context.settings`.
- Read nodes with the types in `src/lib/ast.ts` (`asTs<TSESTree.X>(node)`); the listener argument is typed as plain ESTree.
- Put a rule's default threshold in the rule (`defaultOptions` and the schema's `default`), at the catalog's value. The configs set every rule to `"error"` with no options.
- A rule that needs type information sets `requiresTypeChecking: true`, reads `context.sourceCode.parserServices`, and is registered as type-checked. It goes in `recommended-type-checked` only.

### Fixes

Every fix keeps the code doing exactly what it did before. When the catalog lists cases with no fix, the rule reports them without one. Use the helpers in `src/lib/safe-fix.ts`, which implement the catalog's "How fixes stay safe":

- `removeRange` and `semicolonGuard`: removing or moving code never joins two statements in code without semicolons. Use them whenever a fix removes or moves a statement or class member.
- `continuesStatement(previous, next)`: the same check for code a fix inserts somewhere else.
- `removeComment`: deletes a comment without changing how the code around it parses.
- `isDirectiveComment`: a comment no fix may change or remove (`eslint-*`, `@ts-*`, `#__PURE__` and the rest).

A fix must be idempotent, and the fixed code must not be reported again by the same rule.

### The tests

`runRuleTests(name, rule, { valid, invalid })` runs every case under ESLint's `RuleTester` and Oxlint's. Cases default to `file.ts`; set `filename` to `file.js`, `file.jsx`, `file.tsx` or a `*.test.ts` name when the language matters. On top of `RuleTester`'s own checks, it adds for every fix:

1. **the output reports nothing**, which also proves a second `--fix` changes nothing. For a partial fix that leaves a report, list those reports in `outputErrors`.
2. **the code behaves the same before and after**, when the case has `behaviour`: an expression (or a list of them) evaluated after the code and after the output, in fresh contexts. Both must give the same JSON value. Give every fix case a `behaviour` that exercises the changed code with several inputs, including edge cases.

A case that cannot run under Oxlint sets `eslintOnlyBecause` with the reason. Use it only for a real difference between the linters, never to skip a failure in the rule.

Every rule's tests include:

- each "reports" and "does not report" example in its catalog entry,
- the regression cases the catalog's [Regression cases](docs/catalog.md#regression-cases) table assigns to it,
- for a fix: each condition under which the fix does not apply, as a case with `output: null`,
- for a comment rule: a legal header, a regular-expression explanation and a "why" comment that pass (CMT-02), and directive comments left alone.

### The doc page

`docs/rules/<rule>.md` has these sections, in this order:

1. `# clean-code-book/<rule>`, then the one-line description, then the config, fix and catalog entry lines.
2. `## What the book says`: the passage, quoted, with the chapter, section and bookCTX chunk.
3. `## What it reports`, including what it does not report and why.
4. `## Examples`, incorrect then correct.
5. `## Options`, if the rule has any.
6. `## Fix`, for a rule with a fix: what it does and every case where it does not apply.
7. `## Why there is no autofix`, for a rule with no fix: the reason the catalog approved.

`docs/rules/return-boolean-directly.md` and `docs/rules/no-overloaded-constructors.md` are the models. A test checks that every rule has its page and the right sections.
