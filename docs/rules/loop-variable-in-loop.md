# clean-code-book/loop-variable-in-loop

Declare a loop's control variable in the loop statement instead of before it.

- **Config:** `recommended`
- **Fix:** yes (partial)
- **Catalog entry:** FMT-05

## What the book says

> "Variables should be declared as close to their usage as possible. Because our functions are very short, local variables should appear at the top of each function, as in this longish function from JUnit 4.3.1."

*Clean Code, 2nd Edition*, chapter 6 Formatting § Variable Declarations (bookCTX chunk 11). The book's next sentence is: "Control variables for loops should usually be declared within the loop statement".

## What it reports

A `let` variable declared before a `for` loop whose init assigns it (`let i; for (i = 0; …)`), when nothing reads the variable after the loop.

It does not report a variable that is read after the loop, since it then belongs outside it; a `var`; a `for` loop whose init does not assign the variable; or `while` and `do` loops, which have no place to declare it.

## Examples

Incorrect:

```ts
function sum(values: number[]): number {
  let total = 0;
  let i;
  for (i = 0; i < values.length; i++) {
    total += values[i];
  }
  return total;
}
```

Correct:

```ts
function sum(values: number[]): number {
  let total = 0;
  for (let i = 0; i < values.length; i++) {
    total += values[i];
  }
  return total;
}
```

## Fix

The fix removes the declaration and declares the variable in the loop's init, with its type annotation if it has one: `let i: number; for (i = 0; …)` becomes `for (let i: number = 0; …)`. The removal follows the catalog's "How fixes stay safe", so in code without semicolons a `;` that starts the line after the loop stays where it is.

There is no fix, and the rule only reports, when:

- a reference to the variable is outside the `for` statement, or inside a function or class nested in it. A `let` in the loop header creates a new binding for each iteration, so a closure would see a different value.
- the declaration declares other variables too, or gives the variable an initializer.
- the declaration does not come directly before the loop.
- the loop's init assigns more than the variable (`for (i = 0, j = 1; …)`).
- the value assigned in the init reads the variable (`for (i = i ?? 0; …)`). In `for (let i = i ?? 0; …)` that read is in the temporal dead zone and throws.
