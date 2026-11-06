# clean-code-book/name-length-matches-scope

Use one-letter names only for local variables in very short scopes.

- **Config:** `recommended`
- **Fix:** none
- **Catalog entry:** NAM-02

## What the book says

> "Our preference is that very short, or single-letter, names ought *only* to be used as local variables inside very short scopes. If a variable or constant might be seen or used in multiple places in a body of code, it is best to give it a search-friendly name."

*Clean Code, 2nd Edition*, chapter 4 Meaningful Names § Use Searchable Names, § Variable Names (bookCTX chunk 8).

## What it reports

A one-letter binding (a variable, parameter, catch parameter or function name, `a` to `z` or `A` to `Z`) that is:

- exported (`export const n`, `export { k }`),
- declared at the top level of the file (module scope, or global scope in a script), where the whole file can see it, or
- declared in a scope that spans more than `maxLines` lines (3 by default). The scope is the one the binding lives in: the function for a parameter or a `var`, the block or loop for a `let` or `const`, the enclosing function for a nested function declaration.

It does not report:

- `catch (e)`, which the book allows: "The name `e` is often used to denote the specific error that was raised in a `try` / `catch` block";
- `_` and `$`, which are not letters;
- type parameters (`<T>`), imports (`import * as z`) and class names, which are not variables, parameters or functions.

## Examples

Incorrect:

```ts
export function total(items: number[]): number {
  let t = 0;
  for (const item of items) t += item;
  log(t);
  return t;
}
```

Correct:

```ts
export function total(items: number[]): number {
  let sum = 0;
  for (const item of items) sum += item;
  log(sum);
  return sum;
}

export const doubled = [1, 2].map((x) => x * 2);
```

## Options

```json
{ "maxLines": 3 }
```

- `maxLines` (default `3`): the longest scope, in lines, in which a one-letter local is allowed. The book's example is `n` in a scope "two lines long", and it gives no maximum; 3 covers a one-line callback or a three-line loop, and nothing longer.

## Why there is no autofix

It needs a name that says what the value is, which the syntax cannot tell.
