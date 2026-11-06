# Writing a rule

Every rule in this plugin comes from an entry of [`docs/catalog.md`](docs/catalog.md). The catalog entry is the specification: what the rule reports, what it leaves alone, its threshold, and exactly when its fix applies. A rule does what its entry says, no more and no less. If the entry is wrong or impossible to build as written, change the catalog in the same pull request and say why.

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
