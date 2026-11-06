# Catalog: the `typescript` config, practices of the TypeScript type system and of JavaScript

This catalog is the specification for the rules of the opt-in `typescript` config. No rule is written until this catalog is approved. It is separate from [`docs/catalog.md`](catalog.md), which quotes *Clean Code, 2nd Edition*, and from [`docs/catalog-ai.md`](catalog-ai.md), which names the habits of AI-generated code. Its entries come from the TypeScript and JavaScript books in the bookCTX library. The `typescript` config covers TypeScript and plain JavaScript, on the same files as `recommended` (`ALL_FILES` in `src/configs.ts`). It stacks on `recommended` the way `ai` does: `[...recommended, ...typescript]`. `recommended` is unchanged by it. ADR 0001 of A11-415 records why the practices are split into per-language configs, each with an `-extended` companion.

Each entry gives:

- **Source**: the book, by its bookCTX slug, the chunk, and the section the passage sits under. `programming-typescript chunk 11` means `get_chunk(book_slug="programming-typescript", chunk=11)`.
- **Quote**: the passage, copied verbatim from that chunk, including the extraction's own spacing before punctuation (for example "`any` , and").
- **Class**: one of seven.
  - **syntax**: a custom rule, named `ts-<name>`, that needs only the syntax tree and scope analysis. It runs under ESLint and Oxlint, and goes in `typescript`.
  - **types**: a custom rule that needs type information. It runs under ESLint only, and goes in `typescript-type-checked`.
  - **built-in**: a rule ESLint core already has, that Oxlint also runs natively. It goes in `typescript` as configuration only, and adds no dependency.
  - **third-party**: a rule another plugin already has. The entry names the plugin and the rule, and says whether Oxlint runs it natively. It goes in the [`typescript-extended`](#extended-configs) companion only. The plain `typescript` config never turns it on, so it adds no peer dependency. typescript-eslint is in this class too, as the ticket's acceptance asks, although [`catalog.md`](catalog.md) counts its rules as built-in; see the [owner's approval list](#what-the-owner-is-asked-to-approve), item 2.
  - **covered**: a rule in `recommended` or `ai` already checks it. The entry names that rule and its entry.
  - **conflicts**: the practice clashes with a rule of `recommended` or `ai`. The entry names the clash, and [Conflicts with `recommended` and `ai`](#conflicts-with-recommended-and-ai) gives one resolution.
  - **not lintable**: the reason is given.
- **Rule**, **Reports**, **Does not report** and **Fix**: for each `syntax` entry. **Rule** and **Setting** for each `built-in` and `third-party` entry.

Every rule this catalog proposes is set to `error`, as in the rest of the plugin.

The books quoted:

| Slug | Book |
| --- | --- |
| `programming-typescript` | *Programming TypeScript*, Boris Cherny |
| `clean-code-with-typescript-1-edition-elevate-your-typescript-6-skills-with-clean` | *Clean Code with TypeScript*, Rukevwe Ojigbo and Sanjay Krishna Anbalagan (below: `clean-code-with-typescript-…`) |
| `javascript-the-definitive-guide` | *JavaScript: The Definitive Guide*, David Flanagan |

## What the owner is asked to approve

Approving this pull request approves the items below.

1. **The entries and their classes**, TS-01 to TS-16, as listed in [The rule set at a glance](#the-rule-set-at-a-glance): three custom `syntax` rules (TS-04, TS-14, TS-15), one `built-in` (TS-06), seven `third-party` (TS-01, TS-02, TS-03, TS-10, TS-11, TS-13, TS-16), two `covered` (TS-07, TS-08), two `conflicts` (TS-09, TS-12) and one `not lintable` (TS-05).
2. **typescript-eslint as `third-party`.** The ticket's acceptance says a practice typescript-eslint already lints is `third-party`, and this catalog follows it. `catalog.md` instead calls typescript-eslint rules `built-in`, and `recommended` turns one on (CD-04). typescript-eslint is already an optional peer dependency, so the owner may instead move TS-01, TS-02, TS-03 and TS-13 into the plain `typescript` config without adding a dependency. This catalog does not, so that the plain config stays ESLint core plus this plugin.
3. **The conflict resolutions** in [Conflicts with `recommended` and `ai`](#conflicts-with-recommended-and-ai): TS-09's `argsIgnorePattern: "^_"`, which changes `recommended` in text only and would be built in a follow-up, and TS-12's drop.
4. **Settings the books do not state.** Each is marked **Owner sign-off** in its entry: TS-02 (`assertionStyle: "never"`), TS-06 (`eqeqeq` `"always"`, so `x == null` is reported too) and TS-13 (`lib: "never"`).
5. **The extended configs and their final name.** `typescript-extended` and `typescript-extended-type-checked`, listed in [Extended configs](#extended-configs). `-extended` is a working name. It is not an established suffix in the ESLint ecosystem (typescript-eslint's `strict` and `all` mean other things), so the owner chooses the final suffix. The same suffix should be used by `react-extended` and `node-extended`.
6. **New optional peer dependencies.** `eslint-plugin-promise`, for TS-11 only. It is a fifth plugin beyond the four the ticket names. If the owner declines it, TS-11 leaves `typescript-extended` and stays a recommendation in this catalog. typescript-eslint is already an optional peer dependency.
7. **Custom rules without an autofix.** TS-04, TS-14 and TS-15 have none; each entry says why.
8. **Quotations in a public repository.** The quoted passages are the publishers' text. About 20 short passages appear here, each with a citation and used for commentary. As with `catalog.md` (its item 7), the owner decides before merging whether they stay, or whether the catalog keeps only the citations.

## The rule set at a glance

| Rule | Entry | Config | Class | Fix |
| --- | --- | --- | --- | --- |
| `@typescript-eslint/no-explicit-any` | TS-01 | typescript-extended | third-party | none |
| `@typescript-eslint/consistent-type-assertions` | TS-02 | typescript-extended | third-party | none |
| `@typescript-eslint/no-non-null-assertion` | TS-03 | typescript-extended | third-party | none |
| `ts-no-definite-assignment-assertion` | TS-04 | typescript | syntax | no fix |
| — (`strict` in `tsconfig.json`) | TS-05 | — | not lintable | — |
| `eqeqeq` | TS-06 | typescript | built-in | built-in fix |
| `no-fallthrough` | TS-07 | recommended | covered (CLS-05) | — |
| `no-unused-vars`, `@typescript-eslint/no-unused-vars` | TS-08 | recommended | covered (HRM-01) | — |
| `argsIgnorePattern` on HRM-01's rules | TS-09 | recommended (proposed) | conflicts | — |
| `@typescript-eslint/no-floating-promises` | TS-10 | typescript-extended-type-checked | third-party | none |
| `promise/prefer-catch` | TS-11 | typescript-extended | third-party | none |
| — (log-only `.catch()`) | TS-12 | — | conflicts (AI-02) | — |
| `@typescript-eslint/triple-slash-reference` | TS-13 | typescript-extended | third-party | none |
| `ts-no-amd-dependency` | TS-14 | typescript | syntax | no fix |
| `ts-no-module-augmentation` | TS-15 | typescript | syntax | no fix |
| `@typescript-eslint/switch-exhaustiveness-check` | TS-16 | typescript-extended-type-checked | third-party | none |

## Entries

### The type system's escape hatches

#### TS-01 · Avoid `any`; reach for `unknown`

- **Source:** `programming-typescript` chunk 2, § any and § unknown.
- **Quote:** "It's a last resort type, and you should avoid it when possible." And: "For the few cases where you have a value whose type you really don't know ahead of time, don't use `any` , and instead reach for `unknown` ."
- **Class:** third-party. typescript-eslint `@typescript-eslint/no-explicit-any`. Oxlint runs it natively as `typescript/no-explicit-any` (checked with Oxlint 1.92.0 on 2026-11-06: it reports `let a: any`, and its help text suggests `unknown`).
- **Setting:** `"error"`, default options.

#### TS-02 · Avoid type assertions

- **Source:** `programming-typescript` chunk 11, § Type Assertions; `clean-code-with-typescript-…` chunk 24, § Multiple endpoints without fragile casts.
- **Quote (chunk 11):** "Clearly, type assertions are unsafe, and you should avoid using them when possible."
- **Quote (chunk 24):** "Those casts look like type safety, but they silently disable it, because you are telling TypeScript, "Trust me," at the exact boundary where trust is most dangerous."
- **Class:** third-party. typescript-eslint `@typescript-eslint/consistent-type-assertions`. Oxlint runs it natively as `typescript/consistent-type-assertions`.
- **Setting:** `["error", { assertionStyle: "never" }]`. **Owner sign-off:** "never" is the books' "avoid them when possible" made strict. Checked on 2026-11-06 under typescript-eslint 8.72.1 and Oxlint 1.92.0: both report `x as string` and `(x as unknown) as string`, and neither reports `{ x: 1 } as const`.
- **Where the book needs one:** *Programming TypeScript* builds branded types with an assertion, "the only way to create a value of that type is with an assertion" (chunk 11, § Simulating Nominal Types). A project that brands types puts an `eslint-disable-next-line` directive on each brand constructor. `ai-no-inline-comments` (AI-01) does not report a directive, so the two configs do not fight over it.

#### TS-03 · Avoid non-null assertions

- **Source:** `programming-typescript` chunk 11, § Nonnull Assertions.
- **Quote:** "When you find yourself using non `null` assertions a lot, it's often a sign that you should refactor your code."
- **Class:** third-party. typescript-eslint `@typescript-eslint/no-non-null-assertion`. Oxlint runs it natively as `typescript/no-non-null-assertion` (checked on 2026-11-06: it reports `document.getElementById("x")!`).
- **Setting:** `"error"`.

#### TS-04 · Avoid definite assignment assertions

- **Source:** `programming-typescript` chunk 11, § Definite Assignment Assertions.
- **Quote:** "As with type assertions and non `null` assertions, if you find yourself using definite assignment assertions often, you might be doing something wrong."
- **Class:** syntax. Neither typescript-eslint's `no-non-null-assertion` nor Oxlint's reports this form: checked on 2026-11-06, both leave `let u!: string` and `class K { p!: number }` alone.
- **Rule:** `ts-no-definite-assignment-assertion`.
- **Reports:** a variable declarator with a definite assignment assertion (`let userId!: string`), and a class property with one (`p!: number`).
- **Does not report:** a non-null expression (`x!`), which is TS-03; a declaration or property without `!`; a `declare` property.
- **Fix:** no fix. Removing the `!` makes the code fail to compile until the value is assigned where it is declared, and where that assignment goes is a design decision. The book's exercise asks the reader to "Rewrite the example … to avoid the definite assignment assertion", which is not a mechanical change.

#### TS-05 · Turn on `strict`

- **Source:** `programming-typescript` chunk 2, § tsconfig.json (Table 2-2); `clean-code-with-typescript-…` chunk 4, § Diving into compilerOptions.
- **Quote (chunk 2):** "Be as strict as possible when checking for invalid code. This option enforces that all of your code is properly typed. We'll be using it for all of the examples in the book, and you should use it for your TypeScript project too."
- **Class:** not lintable. `strict`, `noImplicitAny` and `strictNullChecks` are compiler options in `tsconfig.json`, which a linter of source files does not read. `tsc` enforces them. A project check of `tsconfig.json` is a separate tool.

### JavaScript's conversions and control flow

#### TS-06 · Convert types explicitly: no `==`

- **Source:** `programming-typescript` chunk 2, § Are types automatically converted?; `javascript-the-definitive-guide` chunk 8, § Equality with type conversion.
- **Quote (chunk 2):** "The kind of implicit conversion that JavaScript does can be a really hard-to-track-down source of errors, and is the bane of many JavaScript programmers." And: "In short, if you must convert types, do it explicitly."
- **Quote (`javascript-the-definitive-guide` chunk 8):** "The equality operator `==` is like the strict equality operator, but it is less strict. If the values of the two operands are not the same type, it attempts some type conversions and tries the comparison again" — the book's own example is `"1" == true // => true`.
- **Class:** built-in. ESLint core `eqeqeq`. Oxlint runs it natively as `eqeqeq` (checked on 2026-11-06).
- **Setting:** `["error", "always"]`. **Owner sign-off:** `"always"` reports `x == null` too. The guide lists "If one value is `null` and the other is `undefined` , they are equal" among `==`'s conversions, and *Programming TypeScript* asks for explicit conversion without exception, so the idiom is not exempted. `{ null: "ignore" }` is the alternative.
- **Fix:** ESLint's own: it fixes only where both operands have the same type by syntax (`typeof x == "string"`), which keeps behaviour unchanged.

#### TS-07 · No fallthrough between `switch` cases

- **Source:** `programming-typescript` chunk 20, Appendix F (Table F-1).
- **Quote:** "Make sure that every `switch` case either returns a value or breaks." (the row for `noFallthroughCasesInSwitch`)
- **Class:** covered. `no-fallthrough` in `recommended`, from CLS-05 of `catalog.md`.

#### TS-08 · No unused locals or parameters

- **Source:** `programming-typescript` chunk 20, Appendix F (Table F-1).
- **Quote:** "Warn about unused local variables." (the row for `noUnusedLocals`) and "Warn about unused function parameters." (the row for `noUnusedParameters`)
- **Class:** covered. `no-unused-vars` and `@typescript-eslint/no-unused-vars` in `recommended`, from HRM-01 of `catalog.md`.

#### TS-09 · A parameter prefixed with `_` is unused on purpose

- **Source:** `programming-typescript` chunk 20, Appendix F (Table F-1).
- **Quote:** "Prefix your parameter name with `_` to ignore this error." (the row for `noUnusedParameters`)
- **Class:** conflicts, with HRM-01 in `recommended`. Checked on 2026-11-06: `recommended`'s `@typescript-eslint/no-unused-vars` reports `_unused` in `function last(a: number, _unused: number)`, because it sets no `argsIgnorePattern`. A parameter a caller's signature requires (an Express handler's `_req`, say) cannot be removed, and the book's convention for it is reported.
- **Resolution:** see [Conflicts](#conflicts-with-recommended-and-ai), item 1.

### Asynchronous code

#### TS-10 · Do not leave a promise unhandled

- **Source:** `javascript-the-definitive-guide` chunk 32, § 13.2.4 More on Promises and Errors.
- **Quote:** "To preface the discussion, I'd like to stress that careful error handling is really important when doing asynchronous programming. With synchronous code, if you leave out error-handling code, you'll at least get an exception and a stack trace that you can use to figure out what is going wrong. With asynchronous code, unhandled exceptions will often go unreported, and errors can occur silently, making them much harder to debug."
- **Class:** third-party. typescript-eslint `@typescript-eslint/no-floating-promises`, which needs type information. Oxlint lists it as `typescript/no-floating-promises` with `type_aware: true`, so it runs only under `oxlint --type-aware`; see the [Oxlint mapping](#oxlint-mapping).
- **Setting:** `"error"`, default options.

#### TS-11 · Handle a rejection with `.catch()`, not a second `.then()` callback

- **Source:** `javascript-the-definitive-guide` chunk 32, § 13.2.4 More on Promises and Errors.
- **Quote:** "We also learned that it is uncommon (and even unidiomatic) to pass two callbacks to a `.then()` method. Instead, Promise-related errors are typically handled by adding a `.catch()` method invocation to a Promise chain."
- **Class:** third-party. `eslint-plugin-promise` `promise/prefer-catch`. Oxlint runs it natively as `promise/prefer-catch` (listed by `oxlint --rules`, 1.92.0). This plugin is not one of the four the ticket names; see the [owner's approval list](#what-the-owner-is-asked-to-approve), item 6.
- **Setting:** `"error"`.

#### TS-12 · A `.catch()` that only logs

- **Source:** `clean-code-with-typescript-…` chunk 12, § Handling errors with promises.
- **Quote:** the book's example ends its promise chain with "`. catch ( error = > { console . error ( "An error occurred:" , error.message);`", a handler that logs the error and carries on.
- **Class:** conflicts, with AI-02 (`ai-no-ceremonial-catch`) in `ai`. AI-02 names exactly this, log and swallow, as a habit to remove: "Log and swallow turns a failure into a log line: the caller carries on with a result that was never produced." The book's example is not adopted as a practice.
- **Resolution:** see [Conflicts](#conflicts-with-recommended-and-ai), item 2.

### Modules and directives

#### TS-13 · Use `import`, not `/// <reference>` directives

- **Source:** `programming-typescript` chunk 20, Appendix E, Triple-Slash Directives.
- **Quote:** of the `path` directive: "If your project uses `import` s and `export` s, you likely won't ever use this directive." Of the `lib` directive: "Declaring the `lib` s you depend on in your *tsconfig.json* is almost always a better option."
- **Class:** third-party. typescript-eslint `@typescript-eslint/triple-slash-reference`. Oxlint runs it natively as `typescript/triple-slash-reference` (checked on 2026-11-06: with its defaults it reports `/// <reference path="./x.d.ts" />`).
- **Setting:** `["error", { path: "never", types: "prefer-import", lib: "never" }]`. **Owner sign-off** on `lib: "never"`: the book says "almost always", and a declaration file for a project without a `tsconfig.json` is the case it leaves open. The build ticket checks that Oxlint's port accepts the `lib` option before it maps the setting.

#### TS-14 · No `amd-dependency` directive

- **Source:** `programming-typescript` chunk 20, Appendix E, § Deprecated Directives.
- **Quote:** "You should never use the `amd-dependency` directive … and instead stick to a regular `import` ."
- **Class:** syntax. TS-13's rule checks `reference` directives only, so it does not see this one.
- **Rule:** `ts-no-amd-dependency`.
- **Reports:** a `/// <amd-dependency … />` comment.
- **Does not report:** `/// <amd-module … />`, which the book lists among the directives "you are most likely to use"; `reference` directives (TS-13).
- **Fix:** no fix. The `import` that replaces the directive needs a binding name and a module path in the form the project's module resolution uses, and the directive's `name` attribute is not always a valid binding.

#### TS-15 · Wrap a module rather than augment it

- **Source:** `programming-typescript` chunk 20, § Modules.
- **Quote:** "As noted at the start of this section, it's good practice to avoid this pattern when possible (even though it's cool) because it can make your modules brittle and dependent on load order. Instead, try to use composition so that your module extensions consume the module they're extending, and export a wrapper rather than modifying that module."
- **Class:** syntax.
- **Rule:** `ts-no-module-augmentation`.
- **Reports:** a `declare module "<specifier>" { … }` with a string-literal name, in a file that has an `import` or `export` (module mode). That is the augmentation form the book shows (`import 'react'` then `declare module 'react'`).
- **Does not report:** the same declaration in a script-mode `.d.ts` file with no `import` or `export`, which declares types for an untyped module rather than changing a typed one; `declare global { … }`, which the book uses to extend a built-in prototype safely (chunk 11, § Safely Extending the Prototype); `declare module` with an identifier name (a namespace).
- **Fix:** no fix. The replacement is a wrapper module, and its name and its callers are a design change.

#### TS-16 · Check that a `switch` over a union handles every member

- **Source:** `clean-code-with-typescript-…` chunk 24, § Making variants explicit with discriminated unions.
- **Quote:** "That `never` line looks small, but it changes how the system behaves under change. If you add a third variant later, say `kind: 'rate-limited'` , and forget to handle it, the build fails. Correctness is enforced structurally."
- **Class:** third-party. typescript-eslint `@typescript-eslint/switch-exhaustiveness-check`, which needs type information and checks the same thing without the `never` line. Oxlint lists it as `typescript/switch-exhaustiveness-check` with `type_aware: true`.
- **Setting:** `"error"`, default options.

## Conflicts with `recommended` and `ai`

Each clash this catalog found, with one proposed resolution. The cases the plan asked to check that turned out not to clash are listed after them, with what was checked.

1. **TS-09 against HRM-01 (`no-unused-vars`).** The book's convention for a parameter that must exist but is not used is a `_` prefix; `recommended` reports it. **Resolution: an option on the existing rule.** `recommended` sets `argsIgnorePattern: "^_"` on `no-unused-vars` (JavaScript), `@typescript-eslint/no-unused-vars` (TypeScript) and Oxlint's `no-unused-vars`. This is a change to `recommended`, proposed here in text only, as the ticket allows. It is built in a follow-up ticket once approved, with a line added to HRM-01 in `catalog.md` citing this entry. Clean Code's HRM-01 does not argue against a marked parameter, and a parameter that a caller's signature requires cannot be deleted, so the option loses no check the book asks for. If the owner declines, TS-09 is dropped and `recommended` stays as it is.
2. **TS-12 against AI-02 (`ai-no-ceremonial-catch`).** The book's promise example logs the error and carries on, which is the log-and-swallow habit AI-02 reports in a `catch` clause. **Resolution: drop the entry.** `typescript` adopts no practice from the example and proposes no rule for it. AI-02 checks `catch` clauses only, and extending it to `.catch()` callbacks is a question for `catalog-ai.md`, not for this catalog.

Checked, no clash:

- **TS-16 against OBJ-05 (`one-switch-per-type`) and FN-01, FN-02.** TS-16 asks that the switch be complete, not that there be more of them, so it applies to the one switch OBJ-05 allows. A switch over a large union is still reported by FN-01 and FN-02 for its length; `catalog.md` already records that under FN-02, "Firing on a discriminated union, for owner sign-off".
- **TS-02's brand constructors against AI-01 (`ai-no-inline-comments`).** The `eslint-disable-next-line` directive a branded type needs is a tool directive, which AI-01 does not report.
- **TS-04 and TS-06 against `recommended` and `ai`.** No rule in either reports `===`, or a declaration that is assigned where it is declared, which is what these two entries ask for.

## Gaps

These are topics the plan expects *Effective TypeScript* (Dan Vanderkam) to ground, and that the library could not ground in this run. No entry is written for them from memory. Each becomes an entry, or is dropped, once the book is in the library.

How the library was searched: bookCTX allowed three `search_library` calls in this run, each with up to six questions. The TypeScript call (tag `programming`) asked about `any` and `unknown`, non-null assertions, type assertions, strict compiler flags, exhaustive switches and strict equality, and each came back with a passage from a book the library holds, used above. The topics below were not reachable in the budget left, so for each one the library's coverage is unknown rather than shown to be none. The follow-up ticket searches each before the book arrives.

- **Object wrapper types** (`String`, `Number`, `Boolean`, `Object`, `{}` as types). Not searched.
- **`@ts-ignore` against `@ts-expect-error`.** *Programming TypeScript*'s index lists `@ts-ignore` only for untyped JavaScript (chunk 20, Index); no passage read recommends one over the other.
- **`readonly` for parameters a function does not mutate.** Not searched.
- **Typing the value of a `catch` or `.catch()` as `unknown`.** Not searched; typescript-eslint's `use-unknown-in-catch-callback-variable` is the likely rule.
- **Index signatures against `Map` and `Record`.** Not searched.

**Recorded in bookCTX:** not yet. This run's machine refuses `search_oreilly` and `request_book` (its connectors allow only the read tools), so the request is left for the person's session. The pull request gives the exact call, with this reason: "The library's TypeScript books (Programming TypeScript, Clean Code with TypeScript) ground any/unknown, assertions, strict flags and exhaustive switches, but not object wrapper types, @ts-ignore versus @ts-expect-error, readonly parameters, unknown in catch variables, or index signatures versus Map; catalog-typescript.md lists these as gaps."

## Extended configs

`typescript-extended` turns on the `third-party` entries that need no type information. `typescript-extended-type-checked` adds the two that do, and needs `parserOptions.projectService` the way `recommended-type-checked` does. Both stack on `typescript`: `[...recommended, ...typescript, ...typescriptExtended]`. Neither repeats `typescript`'s own rules.

### `typescript-extended`

| Rule | Setting | Files | Entry |
| --- | --- | --- | --- |
| `@typescript-eslint/no-explicit-any` | `"error"` | `TS_FILES` | TS-01 |
| `@typescript-eslint/consistent-type-assertions` | `["error", { assertionStyle: "never" }]` | `TS_FILES` | TS-02 |
| `@typescript-eslint/no-non-null-assertion` | `"error"` | `TS_FILES` | TS-03 |
| `@typescript-eslint/triple-slash-reference` | `["error", { path: "never", types: "prefer-import", lib: "never" }]` | `TS_FILES` | TS-13 |
| `promise/prefer-catch` | `"error"` | `ALL_FILES` | TS-11 |

### `typescript-extended-type-checked`

Everything in `typescript-extended`, and:

| Rule | Setting | Files | Entry |
| --- | --- | --- | --- |
| `@typescript-eslint/no-floating-promises` | `"error"` | `TS_FILES` | TS-10 |
| `@typescript-eslint/switch-exhaustiveness-check` | `"error"` | `TS_FILES` | TS-16 |

### Optional peer dependencies

The pattern is `package.json`'s `peerDependenciesMeta`, where `eslint`, `oxlint` and `typescript-eslint` are already `optional: true`.

- `typescript-eslint`: already an optional peer dependency. Nothing changes.
- `eslint-plugin-promise`: new, `optional: true`. Needed by `typescript-extended` only, for TS-11. Its version range is set by the build ticket.

### Oxlint mapping

The Oxlint export of `typescript-extended` uses Oxlint's native rules and loads no JS plugin for them. It sets `plugins: ["typescript", "promise"]`, since Oxlint's `typescript` and `promise` rules run only with those plugins enabled.

| ESLint rule | Oxlint | Note |
| --- | --- | --- |
| `@typescript-eslint/no-explicit-any` | `typescript/no-explicit-any` | native, checked |
| `@typescript-eslint/consistent-type-assertions` | `typescript/consistent-type-assertions` | native, checked with `assertionStyle: "never"` |
| `@typescript-eslint/no-non-null-assertion` | `typescript/no-non-null-assertion` | native, checked |
| `@typescript-eslint/triple-slash-reference` | `typescript/triple-slash-reference` | native; checked with defaults, `lib` option to check at build |
| `promise/prefer-catch` | `promise/prefer-catch` | native (listed by `oxlint --rules`) |
| `@typescript-eslint/no-floating-promises` | left out | Oxlint runs it only with `--type-aware`. This plugin's Oxlint configs carry no type-aware rules (`src/oxlint.ts`: "Rules that need type information are not here"), so `typescript-extended-type-checked` has no Oxlint export, as `recommended-type-checked` has none. |
| `@typescript-eslint/switch-exhaustiveness-check` | left out | the same reason |

"Checked" means: run with Oxlint 1.92.0, the version this repository pins, on 2026-11-06, against a file with the case in it.
