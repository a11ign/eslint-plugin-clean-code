# clean-code-book/return-boolean-directly

Return a boolean expression directly instead of branching to `return true` and `return false`.

- **Config:** `recommended`
- **Fix:** yes
- **Catalog entry:** CD-01

## What the book says

> "We rarely say that things are flat-out wrong in programming, but this is one of those cases. Simply (and we don't use that word lightly) return the boolean expression:"

*Clean Code, 2nd Edition*, chapter 21 Continuous Design § Return Boolean Expressions (bookCTX chunk 30).

## What it reports

- `if (c) { return true; } else { return false; }`, with or without braces,
- its inverse, `if (c) return false; else return true;`,
- the same with the `else` left out, when the `if` is followed directly by the other `return`.

The ternary form, `c ? true : false`, is reported by core `no-unneeded-ternary`, which `recommended` turns on.

## Examples

Incorrect:

```ts
function isAdult(age: number): boolean {
  if (age >= 18) {
    return true;
  }
  return false;
}
```

Correct:

```ts
function isAdult(age: number): boolean {
  return age >= 18;
}
```

## Fix

The fix writes `return c;` when `c` is a boolean by its syntax: a comparison, `!x`, `instanceof`, `in`, a boolean literal, or `&&` or `||` of these. Otherwise it writes `return !!(c);`, or `return !(c);` for the inverse, so the function returns exactly the same `true` or `false` as before for every value of `c`. Comments inside the replaced statements are moved above the new `return`, because a line comment between `return` and its value would end the statement.
