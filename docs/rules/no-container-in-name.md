# clean-code-book/no-container-in-name

Do not end a name in `List`, `Array`, `Map` or `Set` unless the value is that kind of container.

- **Config:** `recommended-type-checked`
- **Fix:** none
- **Catalog entry:** NAM-03
- **Type information:** required. The rule reads types through typescript-eslint's `projectService`. Without type information it reports nothing.

## What the book says

> "Programmers must avoid leaving false clues that obscure the meaning of code. For example, do not refer to a grouping of accounts as an `accountList` unless it's actually a `List` ."

*Clean Code, 2nd Edition*, chapter 4 Meaningful Names § Avoid Disinformation (bookCTX chunk 8).

## What it reports

A variable, parameter (including destructured ones and parameter properties), `catch` binding or class field whose name ends in the word `List`, `Array`, `Map` or `Set` (`accountList`, `idMap`, `SEEN_SET`), when its type is not that container:

- `List` and `Array`: an array, a tuple, or an array-like type, indexed by number with a `length` (`NodeList`, `Uint8Array`, `ArrayLike<T>`). A string is not a list.
- `Map`: a `Map`, `ReadonlyMap` or `WeakMap`, or a class that extends one.
- `Set`: a `Set`, `ReadonlySet` or `WeakSet`, or a class that extends one.

A class or interface named for the container (`LinkedList`, `HashMap`, `SortedSet`) also counts, as a `LinkedList` is a list in the book's sense. A type alias does not: `type AccountMap = Record<string, Account>` is a plain object, and `accountMap: AccountMap` is reported. `null` and `undefined` are ignored (`string[] | undefined` is a list), and every other member of a union must be the container.

It does not report:

- a word that only ends in the letters: `dataOffset`, `userSubset`, `bitmap`, `checklist`.
- a function, which is named for what it does (`loadAccountList`).
- a value typed `any` or `unknown`, or an unconstrained type parameter. A constrained one is judged by its constraint.

## Examples

Incorrect:

```ts
const accountList = new Set<Account>();
const idSet: number[] = [];
function find(accountMap: Record<string, Account>) {}
```

Correct:

```ts
const accounts = new Set<Account>();
const accountList: Account[] = [];
const ids: number[] = [];
function find(accountsById: Record<string, Account>) {}
```

## Why there is no autofix

The right name depends on what the grouping is: `accounts`, `accountGroup` and `bunchOfAccounts` each say something different. Changing the type instead changes every caller.
