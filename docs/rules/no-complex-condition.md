# clean-code-book/no-complex-condition

Extract a condition that mixes `&&` and `||`, or joins more than three operands, into a named predicate.

- **Config:** `recommended`
- **Fix:** none
- **Catalog entry:** ONE-04

## What the book says

> "Often the conditionals that control these pathways are complex, depending on combinations of method calls and variables- `if (x(a) && y || !z(c, d)` , for example. Those details don't make it clear why we're heading into a certain piece of code. An extracted predicate's method name can impart immediate understanding."

*Clean Code, 2nd Edition*, chapter 13 Clean Classes § Fixing the Problem (bookCTX chunk 21).

## What it reports

The test of an `if` (including an `else if`), a `while`, a `do…while` or a ternary when it:

- mixes `&&` and `||`, as the book's example does, or
- joins more than the threshold of operands (3 by default) with one of them: `a && b && c` passes, `a && b && c && d` is reported.

Parentheses do not hide a mix, and neither does a `!` in front of a group: `!(a && b) || c` mixes both. A `??` expression, a call (with whatever its arguments hold) and any other expression count as one operand. A logical expression outside a condition, such as `const ok = a && b || c`, is not checked.

## Examples

Incorrect:

```ts
if (order.total > 100 && customer.isMember || coupon !== undefined) {
  applyDiscount(order);
}
```

Correct:

```ts
function isEligibleForDiscount(order: Order, customer: Customer, coupon?: Coupon): boolean {
  return (order.total > 100 && customer.isMember) || coupon !== undefined;
}

if (isEligibleForDiscount(order, customer, coupon)) {
  applyDiscount(order);
}
```

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `maxOperands` | `3` | The most operands one operator may join in a condition. A mix of `&&` and `||` is reported whatever this is. |

```js
"clean-code-book/no-complex-condition": ["error", { maxOperands: 3 }]
```

## Why there is no autofix

The remedy is a named predicate, and the name has to say what the condition means. Hoisting the test into a `const` would also change when it is evaluated in a `while` loop and in an `else if`.
