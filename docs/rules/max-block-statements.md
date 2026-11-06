# clean-code-book/max-block-statements

Keep the blocks inside `if`, `else`, loops, `try`, `catch` and `finally` to one or two statements.

- **Config:** `recommended`
- **Fix:** none
- **Catalog entries:** FN-05, FH-06

## What the book says

> "Keeping functions very small implies that the blocks within `if` statements, `else` statements, `while` statements, and so on will be only one or two lines long. Often that block will contain a call to another function."

*Clean Code, 2nd Edition*, chapter 7 Clean Functions § Well-Written Prose (bookCTX chunks 12, 17).

> "`Try/catch` blocks are ugly in their own right. They confuse the structure of the code and mix error processing with normal processing. So it is better to extract the bodies of the `try` and `catch` blocks out into functions of their own."

*Clean Code, 2nd Edition*, chapter 8 Function Heuristics § Extract Try/Catch Blocks (bookCTX chunk 14).

## What it reports

A block with more statements than the threshold, as the body of an `if`, an `else`, a `for`, `for…in`, `for…of`, `while` or `do` loop, or as the `try`, `catch` or `finally` block of a `try` statement. A nested block statement counts as one statement, and its own body is checked separately. An `else if` is checked as its own `if`.

It does not check function bodies (FN-01's `max-lines-per-function` limits those), `switch` cases, or bodies written without braces, which are a single statement.

## Examples

Incorrect:

```ts
if (order.isPaid()) {
  order.ship();
  mailer.sendShippedNotice(order);
  audit.record("shipped", order.id);
}
```

Correct:

```ts
if (order.isPaid()) {
  shipAndNotify(order);
}
```

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `max` | `2` | The most statements a block may hold. The book's "one or two lines", read as statements so that a formatter's line wrapping does not change the result. |

```js
"clean-code-book/max-block-statements": ["error", { max: 2 }]
```

## Why there is no autofix

The remedy is extracting the block into a named function, and the name must describe what the block means.
