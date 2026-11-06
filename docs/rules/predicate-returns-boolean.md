# clean-code-book/predicate-returns-boolean

A function named as a question (`is`, `has`, `can`, `should`) returns a boolean.

- **Config:** `recommended-type-checked`
- **Fix:** none
- **Catalog entry:** NAM-12 (the type half; `no-side-effects-in-predicates` is the syntax half)
- **Type information:** required. The rule reads types through typescript-eslint's `projectService`. Without type information it reports nothing.

## What the book says

> "If a reader trusts the name `isMultipleOfNthPrimeFactor` (which suggests a predicate with no side effects) and doesn't bother to read its code, they will not realize that it has side effects"

*Clean Code, 2nd Edition*, Appendix, The Clean Code Debate (bookCTX chunk 41). Chapter 4 Meaningful Names § Method Names (chunk 8) gives the convention: "accessors, mutators, and predicates should be named according to the local convention. In Java, they are named for their value and prefixed with `get` , `set` , and `is` according to the JavaBeans standard."

## What it reports

A function, method, getter, arrow function or object method named `is`, `has`, `can` or `should` followed by an uppercase letter (`isEmpty`, `hasUser`), whose return type is not `boolean`. These count as boolean: `boolean`, `true`, `false`, a type predicate (`value is string`), and a promise of any of them (an `async` predicate). `boolean | undefined`, `void` and `number` do not.

It does not report:

- a setter: `set isOpen(value)` is named for its property.
- a function that returns `never` or `any`.
- a name where the prefix is not followed by a new word: `island`, `hash`, `canonical`, `shoulder`.

## Examples

Incorrect:

```ts
function hasUser(users: User[], id: number) {
  return users.find((user) => user.id === id); // User | undefined
}

class Cart {
  isEmpty() {
    return this.items.length; // number
  }
}
```

Correct:

```ts
function findUser(users: User[], id: number) {
  return users.find((user) => user.id === id);
}

class Cart {
  isEmpty(): boolean {
    return this.items.length === 0;
  }
}
```

## Why there is no autofix

The fix needs either a new name, which has to say what the value is, or a different return type, which changes what every caller receives.
