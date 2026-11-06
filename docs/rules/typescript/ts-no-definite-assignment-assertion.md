# clean-code-book/ts-no-definite-assignment-assertion

Assign a variable or a class field where it is declared, instead of asserting with `!` that it will be.

- **Config:** `typescript`
- **Fix:** no
- **Catalog entry:** TS-04 in [`docs/catalog-typescript.md`](../../catalog-typescript.md)

## What the book says

> "As with type assertions and non `null` assertions, if you find yourself using definite assignment assertions often, you might be doing something wrong."

*Programming TypeScript*, Boris Cherny, § Definite Assignment Assertions (bookCTX `programming-typescript` chunk 11).

## What it reports

A definite assignment assertion: the `!` after the name in

- a variable declaration, `let userId!: string`;
- a class field, `name!: string`.

It does not report:

- a non-null expression, `element!`, which is `@typescript-eslint/no-non-null-assertion` in `typescript-extended` (TS-03);
- a declaration or a field without `!`, or with `?`;
- a `declare` field.

TypeScript's own `strictPropertyInitialization` checks that a field without `!` is assigned in the constructor; the `!` turns that check off for the field, and this rule reports it.

## Examples

Incorrect:

```ts
class Account {
  name!: string;
}

let userId!: string;
fetchUser();
```

Correct:

```ts
class Account {
  constructor(public name: string) {}
}

const userId: string = fetchUser();
```

## Why there is no autofix

Removing the `!` makes the code fail to compile until the value is assigned where it is declared, and where that assignment goes is a design decision. The book's own exercise asks the reader to rewrite the example to avoid the assertion, which is not a mechanical change.
