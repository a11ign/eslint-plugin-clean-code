# Catalog: the `react` config, practices of React components and hooks

This catalog is the specification for the rules of the opt-in `react` config. No rule is written until this catalog is approved. It is separate from [`docs/catalog.md`](catalog.md) (*Clean Code, 2nd Edition*), [`docs/catalog-ai.md`](catalog-ai.md) (the habits of AI-generated code) and [`docs/catalog-typescript.md`](catalog-typescript.md) (the TypeScript type system and JavaScript). Its entries come from the React books in the bookCTX library. The `react` config applies to `.jsx` and `.tsx` files only (`**/*.{jsx,tsx}`), so that a project without React that turns on every config gets no React rule on its other files. It stacks on `recommended` the way `ai` does: `[...recommended, ...react]`. `recommended` is unchanged by it. ADR 0001 of A11-415 records why the practices are split into per-language configs, each with an `-extended` companion.

Each entry gives:

- **Source**: the book, by its bookCTX slug, the chunk, and the section the passage sits under. `learn-react-with-typescript-third-edition chunk 5` means `get_chunk(book_slug="learn-react-with-typescript-third-edition", chunk=5)`.
- **Quote**: the passage, copied verbatim from that chunk, including the extraction's own markup (for example "**useEffect**").
- **Class**: one of seven.
  - **syntax**: a custom rule, named `react-<name>`, that needs only the syntax tree and scope analysis. It runs under ESLint and Oxlint, and goes in `react`.
  - **types**: a custom rule that needs type information. It runs under ESLint only, and goes in `react-type-checked`. No entry here needs one, so this catalog proposes no `react-type-checked`.
  - **built-in**: a rule ESLint core already has, that Oxlint also runs natively. It goes in `react` as configuration only.
  - **third-party**: a rule another plugin already has (`eslint-plugin-react-hooks`, `eslint-plugin-react`). The entry names the plugin and the rule, and says whether Oxlint runs it natively. It goes in the [`react-extended`](#extended-configs) companion only. The plain `react` config never turns it on, so it adds no peer dependency.
  - **covered**: a rule in `recommended` or `ai` already checks it. The entry names that rule and its entry.
  - **conflicts**: the practice clashes with a rule of `recommended` or `ai`, or with what an entry of `catalog.md` or `catalog-ai.md` names as a harm, even where that entry's rule does not see the case. [Conflicts with `recommended` and `ai`](#conflicts-with-recommended-and-ai) gives one resolution.
  - **not lintable**: the reason is given.
- **Rule**, **Reports**, **Does not report** and **Fix**: for each `syntax` entry. **Rule** and **Setting** for each `third-party` entry.

Every rule this catalog proposes is set to `error`, as in the rest of the plugin.

The books quoted:

| Slug | Book |
| --- | --- |
| `learn-react-with-typescript-third-edition` | *Learn React with TypeScript*, 3rd edition, Carl Rippon |
| `react-design-patterns-and-best-practices-5-edition-design-build-and-deploy-produ` | *React Design Patterns and Best Practices*, 5th edition, Carlos Santana Roldán (below: `react-design-patterns-…`) |
| `react-application-architecture-for-production-2-edition-a-hands-on-guide-to-arch` | *React Application Architecture for Production*, 2nd edition, Alan Alickovic and Anthony Alicea (below: `react-application-architecture-…`) |
| `test-driven-react-second-edition` | *Test-Driven React*, 2nd edition, Trevor Burnham |

## What the owner is asked to approve

Approving this pull request approves the items below.

1. **The entries and their classes**, RCT-01 to RCT-11, as listed in [The rule set at a glance](#the-rule-set-at-a-glance): two custom `syntax` rules (RCT-06, RCT-07), four `third-party` (RCT-01, RCT-02, RCT-03, RCT-04), two `covered` (RCT-05, RCT-08) and three `not lintable` (RCT-09, RCT-10, RCT-11).
2. **The conflict resolutions** in [Conflicts with `recommended` and `ai`](#conflicts-with-recommended-and-ai): components and custom hooks keep FN-01's 12 lines, with no React override.
3. **The extended config and its final name.** `react-extended`, listed in [Extended configs](#extended-configs). `-extended` is a working name, not an established ecosystem suffix; the owner chooses the final suffix, the same for all three languages.
4. **New optional peer dependencies.** `eslint-plugin-react-hooks` and `eslint-plugin-react`, both `optional: true`, needed by `react-extended` only.
5. **Individual rules rather than the plugins' presets.** *Test-Driven React* uses the presets (`plugin:react/recommended`, `plugin:react-hooks/recommended`, in the `.eslintrc` that follows RCT-01's second quote in `test-driven-react-second-edition` chunk 9). `react-extended` lists rules one by one instead, so that every rule it turns on traces to an entry here and is an `error`. `eslint-plugin-react-hooks`'s own preset sets `exhaustive-deps` to a warning.
6. **Custom rules without an autofix.** RCT-06 and RCT-07 have none; each entry says why.
7. **Quotations in a public repository.** The quoted passages are the publishers' text. About 20 short passages appear here, each with a citation and used for commentary. As with `catalog.md` (its item 7), the owner decides before merging whether they stay, or whether the catalog keeps only the citations.

## The rule set at a glance

| Rule | Entry | Config | Class | Fix |
| --- | --- | --- | --- | --- |
| `react-hooks/rules-of-hooks` | RCT-01 | react-extended | third-party | none |
| `react-hooks/exhaustive-deps` | RCT-02, RCT-03 | react-extended | third-party | none (suggestions in ESLint) |
| `react/jsx-key` | RCT-04 | react-extended | third-party | none |
| `react/no-array-index-key` | RCT-04 | react-extended | third-party | none |
| `no-param-reassign` | RCT-05 | recommended | covered (FH-03) | — |
| `react-no-state-mutation` | RCT-06 | react | syntax | no fix |
| `react-no-untyped-empty-state` | RCT-07 | react | syntax | no fix |
| `max-lines-per-function` | RCT-08 | recommended | covered (FN-01) | — |
| — | RCT-09, RCT-10, RCT-11 | — | not lintable | — |

## Entries

### Hooks

#### RCT-01 · Call hooks at the top level, never conditionally

- **Source:** `learn-react-with-typescript-third-edition` chunk 5, § The rules of Hooks; `test-driven-react-second-edition` chunk 9, § Making Custom Hooks.
- **Quote (chunk 5):** "A Hook can only be called at the top level of a function component. So, a Hook can't be called in a loop or in a nested function such as an event handler." And: "A Hook can't be called conditionally." And: "A Hook can only be used in function components and not class components."
- **Quote (`test-driven-react-second-edition` chunk 9):** "Rules like "hooks must be called in the same order on every render" go against the grain of intuition. Thankfully, an official ESLint plugin can help guard against inadvertent violations of hook rules."
- **Class:** third-party. `eslint-plugin-react-hooks` `react-hooks/rules-of-hooks`. Oxlint runs it natively as `react/rules-of-hooks`, reported under the name `react-hooks(rules-of-hooks)` (checked with Oxlint 1.92.0 on 2026-11-06: it reports a `useState` inside an `if`).
- **Setting:** `"error"`.

#### RCT-02 · List what an effect depends on

- **Source:** `react-design-patterns-…` chunk 3, § eslint-plugin-react-hooks v6: smarter linting; `learn-react-with-typescript-third-edition` chunk 7, § Answers.
- **Quote (chunk 3):** "Version 6 understands React better. It knows about `useEffectEvent` and doesn't complain about its dependencies." And, of the plugin: "The linter is finally working with you instead of against you. It catches real problems while staying out of your way when you're using the new patterns correctly."
- **Quote (chunk 7):** "The other major problem is that no dependencies are defined in the call to **useEffect** . This means the effect function will be executed on every render."
- **Class:** third-party. `eslint-plugin-react-hooks` `react-hooks/exhaustive-deps`. Oxlint runs it natively as `react/exhaustive-deps` (checked on 2026-11-06: it reports `useEffect(() => { setN(n + 1); }, [])` for the missing `n`).
- **Setting:** `"error"`. The plugin's own preset sets it to a warning; see approval item 5.

#### RCT-03 · An effect function is not `async`

- **Source:** `learn-react-with-typescript-third-edition` chunk 7, § Answers.
- **Quote:** "The main problem with the code is that the effect function can't be marked as asynchronous with the **async** keyword. A solution is to revert to the older promise syntax"
- **Class:** third-party. The same rule as RCT-02, `react-hooks/exhaustive-deps`, reports it. Checked on 2026-11-06: Oxlint's `react/exhaustive-deps` reports `useEffect(async () => { … }, [])` with "Effect callbacks are synchronous to prevent race conditions."
- **Setting:** RCT-02's.

### Lists, keys and state

#### RCT-04 · Give list items a stable key, not the array index

- **Source:** `react-design-patterns-…` chunk 9, § Understanding reconciliation and the Fiber architecture; `learn-react-with-typescript-third-edition` chunk 21, § Adding a renderItem prop.
- **Quote (chunk 9):** "If you use array indices as keys, React sees position, not identity: removing the first item makes React think every subsequent item changed because their indices all shifted."
- **Quote (chunk 21):** "The **key** attribute on the list item elements is set to the unique item ID, allowing React to efficiently update the DOM when list items have changed, been added, or removed."
- **Class:** third-party. `eslint-plugin-react`: `react/jsx-key` reports an element in an iterator with no `key`, and `react/no-array-index-key` reports a key built from the index. Oxlint runs both natively under the same names (checked on 2026-11-06 on `items.map((i) => <li>{i}</li>)` and `items.map((i, idx) => <li key={idx}>{i}</li>)`).
- **Setting:** `"error"` for each.

#### RCT-05 · A reducer never mutates its state

- **Source:** `learn-react-with-typescript-third-edition` chunk 6, § Understanding useReducer.
- **Quote:** "A new state object is created during the state change - the current state is never mutated. Mutating the state would result in the component not re-rendering."
- **Class:** covered. A reducer's state is its parameter, and `recommended`'s `no-param-reassign` with `props: true` (FH-03 of `catalog.md`) reports `state.total = …` inside `reducer(state, action)` (checked on 2026-11-06 with this plugin's built `recommended`: "Assignment to property of function parameter 'state'"). The accumulator exemption (`acc`, `accumulator`) does not apply to a parameter named `state`.

#### RCT-06 · Never mutate a `useState` value

- **Source:** `learn-react-with-typescript-third-edition` chunk 6, § Understanding useReducer (RCT-05's passage).
- **Quote:** "Mutating the state would result in the component not re-rendering."
- **Class:** syntax. RCT-05's rule does not see this case: a value from `useState` is a local binding, not a parameter. `eslint-plugin-react`'s `react/no-direct-mutation-state` checks `this.state` in class components only.
- **Rule:** `react-no-state-mutation`.
- **Reports:** in a function, for the binding `x` of `const [x, setX] = useState(…)` (and of `useReducer`):
  - an assignment to a member of `x` (`x.total = 1`, `x[i] = v`), including `++`, `--` and compound assignment, and `delete x.key`;
  - a call of a mutating array method on `x`: `push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill`, `copyWithin`.
- **Does not report:** a copy (`[...x].sort()`, `x.toSorted()`, `{ ...x, total: 1 }`); a reassignment of a different binding with the same name in an inner scope; a `useRef` value, which the book describes as "a mutable value" that "doesn't cause a re-render when changed" (`learn-react-with-typescript-third-edition` chunk 7, § Summary).
- **Fix:** no fix. The replacement passes a new value to the setter, and whether it should be `setX([...x, v])` or the updater form `setX((x) => [...x, v])` depends on what else changes `x` in the same render.

#### RCT-07 · Give an empty `useState` array a type

- **Source:** `learn-react-with-typescript-third-edition` chunk 7, § Answers.
- **Quote:** "Another problem is that the **data** state will have the **any[]** type, which isn't ideal."
- **Class:** syntax.
- **Rule:** `react-no-untyped-empty-state`, in `.tsx` files only.
- **Reports:** a call `useState([])` with no type argument.
- **Does not report:** `useState<Item[]>([])`; `useState(items)` or any non-empty initial value, whose type TypeScript infers; `.jsx` files, which have no type arguments.
- **Fix:** no fix. The rule cannot know the element type.

### Components and structure

#### RCT-08 · Keep components small

- **Source:** `react-application-architecture-…` chunk 2, § Patterns that usually don't work.
- **Quote:** "**One Big Component** : A component that does everything seems efficient at first. You have all the logic in one place. But these components become unmaintainable. They're hard to test because you have to set up the entire world that surrounds the component."
- **Class:** covered. A function component is a function, so `recommended`'s `max-lines-per-function` (FN-01 of `catalog.md`, 12 lines) already limits it. How that limit meets JSX markup is [Conflicts](#conflicts-with-recommended-and-ai), item 1.

#### RCT-09 · Extract reusable stateful logic into a custom hook

- **Source:** `learn-react-with-typescript-third-edition` chunk 21, § Extracting checked logic into a custom hook.
- **Quote:** "We will extract the logic for checked items into a custom hook. This will allow potential future components to use the logic and clean up the code a little."
- **Class:** not lintable. Whether two components share logic that should be one hook is a judgement about meaning, and the duplicated statements are rarely identical. The size half of the advice is FN-01's.

#### RCT-10 · Keep state close to where it is used

- **Source:** `react-application-architecture-…` chunk 2, § Patterns that usually don't work.
- **Quote:** "Global state has its place, but most state should be local. Keep state as close as possible to where it's used, and lift it only when you need to share it."
- **Class:** not lintable. Where a piece of state is read across components is a property of the whole component tree, which a rule sees one file at a time.

#### RCT-11 · Memoise only where it measurably helps

- **Source:** `learn-react-with-typescript-third-edition` chunk 7, § Summary.
- **Quote:** "The **useMemo** and **useCallback** Hooks can be used to memoize values and functions, respectively, and can be used for performance optimization. The examples we used for these Hooks were a little contrived and using **useCallback** didn't improve performance, so remember to check that the use of these Hooks does improve performance."
- **Class:** not lintable. The test the book asks for is a measurement, which no static rule makes.

## Conflicts with `recommended` and `ai`

Each clash this catalog found, with one proposed resolution. The cases the plan asked to check that turned out not to clash are listed after them, with what was checked.

1. **Components against FN-01 (`max-lines-per-function`, 12 lines).** The returned JSX counts toward the 12 lines, so a component with a modest amount of markup is reported. **Resolution: drop the React exemption.** The `react` config proposes no override and no size rule of its own, and FN-01 applies to components unchanged. The React books' remedy for a large component is the one FN-01 asks for: *React Application Architecture for Production* answers the one-big-component problem by "splitting into focused components where each piece of state lives in the component that uses it" (chunk 12, § Colocating state). None of the books states a line limit that a different threshold could cite, and a number chosen here would be one no book grounds. A project that finds 12 too tight for markup changes FN-01 in its own config for `**/*.{jsx,tsx}`, as the README already explains for test files.
2. **Custom hooks against FN-01.** A hook that holds state, an effect with its cleanup and the handlers that change the state can pass 12 lines. **Resolution: drop the exemption,** for the same reason. A custom hook is a function, and a long one can be split into smaller hooks that it calls at its own top level, which RCT-01's rules allow.

Checked, no clash:

- **Boolean props against FH-01 (`no-flag-argument`).** Checked on 2026-11-06 with this plugin's built `recommended` on `.tsx` files: `function Button({ disabled }: { disabled: boolean })`, `function Panel(props: Props)` with `open: boolean` in `Props`, and `onToggle={(open: boolean) => …}` are not reported; `function render(item: string, compact: boolean)` is. A component's props are one destructured object or one `props` parameter, which FH-01 exempts or does not see, and a function written as a JSX attribute is exempt by FH-01's own list.
- **Function components against the class rules** (`no-hybrid-class`, `no-trivial-accessors`, `fields-first`, `no-protected-fields`, and `no-concrete-inheritance` in `recommended-type-checked`). A function component is not a class, so none of them sees it. A class component that extends `React.Component` is not reported by `no-concrete-inheritance`, whose entry SOL-05 in `catalog.md` reports a base class "declared in the project (not in the TypeScript library or `node_modules`)". RCT-01's third quote, "A Hook can only be used in function components and not class components", is enforced by `react-hooks/rules-of-hooks`, not by a class rule.
- **RCT-06 against FH-03 (`no-param-reassign`).** RCT-06 checks `useState` and `useReducer` bindings, which are not parameters, and FH-03 checks parameters, so no mutation is reported twice.
- **`eslint-disable` directives for `react-hooks/exhaustive-deps` against AI-01 (`ai-no-inline-comments`).** A directive is not reported by AI-01.

## Gaps

The four React books in the library grounded every topic this catalog searched for, so no gap names a missing book. How the library was searched: bookCTX allowed three `search_library` calls in this run. The React call (tag `frontend`) asked about the rules of hooks, effect dependencies, keys, state mutation, component size and custom hooks, and each came back with a passage used above.

Topics not reachable in the search budget, whose coverage in the library is unknown rather than shown to be none, and which the build ticket searches before any entry is written for them:

- `useEffect` cleanup (an effect that subscribes and never unsubscribes);
- derived state copied into `useState` from props;
- accessibility rules for JSX (`eslint-plugin-jsx-a11y`), for which the library has accessibility-tagged books;
- the testing books' advice on Testing Library queries (`eslint-plugin-testing-library`, which `test-driven-react-second-edition` chunk 9 also turns on).

## Extended configs

`react-extended` turns on the `third-party` entries. It applies to `**/*.{jsx,tsx}` like `react`, and stacks on it: `[...recommended, ...react, ...reactExtended]`. It needs no type information, so there is no `react-extended-type-checked`.

### `react-extended`

| Rule | Setting | Files | Entry |
| --- | --- | --- | --- |
| `react-hooks/rules-of-hooks` | `"error"` | `**/*.{jsx,tsx}` | RCT-01 |
| `react-hooks/exhaustive-deps` | `"error"` | `**/*.{jsx,tsx}` | RCT-02, RCT-03 |
| `react/jsx-key` | `"error"` | `**/*.{jsx,tsx}` | RCT-04 |
| `react/no-array-index-key` | `"error"` | `**/*.{jsx,tsx}` | RCT-04 |

Hooks are also called from custom hooks in `.ts` files (`useChecked` in RCT-09's source is one). **Technical choice for the owner to confirm:** the two `react-hooks/` rules apply to `**/*.{js,jsx,ts,tsx}` files whose name starts with `use` as well, so that a custom hook in a `.ts` file is checked; the `react/` rules stay on `.jsx` and `.tsx`.

### Optional peer dependencies

The pattern is `package.json`'s `peerDependenciesMeta`, where `eslint`, `oxlint` and `typescript-eslint` are already `optional: true`.

- `eslint-plugin-react-hooks`: new, `optional: true`. Version 6 or later, the version `react-design-patterns-…` chunk 3 describes. The exact range is set by the build ticket.
- `eslint-plugin-react`: new, `optional: true`. Its range is set by the build ticket.

### Oxlint mapping

The Oxlint export of `react-extended` uses Oxlint's native `react` plugin (`plugins: ["react"]`), which carries both plugins' rules, and loads no JS plugin for them.

| ESLint rule | Oxlint | Note |
| --- | --- | --- |
| `react-hooks/rules-of-hooks` | `react/rules-of-hooks` | native, checked |
| `react-hooks/exhaustive-deps` | `react/exhaustive-deps` | native, checked, including the `async` effect of RCT-03 |
| `react/jsx-key` | `react/jsx-key` | native, checked |
| `react/no-array-index-key` | `react/no-array-index-key` | native, checked |

"Checked" means: run with Oxlint 1.92.0, the version this repository pins, on 2026-11-06, against a file with the case in it. The ESLint plugins themselves are not installed in this repository, so their behaviour on the same cases is checked by the build ticket.
