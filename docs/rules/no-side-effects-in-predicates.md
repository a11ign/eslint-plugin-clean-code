# clean-code-book/no-side-effects-in-predicates

A function named as a predicate (`is…`, `has…`, `can…`, `should…`) must not assign to anything declared outside it.

- **Config:** `recommended`
- **Fix:** none
- **Catalog entry:** NAM-12

## What the book says

> "If a reader trusts the name `isMultipleOfNthPrimeFactor` (which suggests a predicate with no side effects) and doesn't bother to read its code, they will not realize that it has side effects"

*Clean Code, 2nd Edition*, Appendix, The Clean Code Debate (bookCTX chunk 41).

> "Depending on your language, accessors, mutators, and predicates should be named according to the local convention. In Java, they are named for their value and prefixed with `get` , `set` , and `is` according to the JavaBeans standard."

*Clean Code, 2nd Edition*, chapter 4 Meaningful Names § Method Names (bookCTX chunk 8).

## What it reports

A function, arrow function, method, getter, object-literal method or class-property arrow named `is`, `has`, `can` or `should` followed by a capital letter, when its body assigns (`=`, `+=` and the other compound operators, `++`, `--`, a destructuring assignment or a `for…in`/`for…of` target) to anything declared outside it:

- `this.*` or `super.*`, also from an arrow inside it;
- a module or closure variable, or an undeclared global, also from a callback inside it;
- a property of one of its parameters (`order.status = "checked"`), or of an object declared outside it.

Each such assignment is reported.

It does not report:

- assignments to the predicate's own locals and parameters, or to properties of its own locals;
- `this` inside a nested regular function or a class field initializer, which is another object's `this`;
- names where the prefix is part of a word (`isolate`, `issue`, `hash`);
- method calls such as `this.cache.set(key)`: whether a call changes anything needs to know what it calls. The type-aware `predicate-returns-boolean` covers the other half of NAM-12.

## Examples

Incorrect:

```ts
class Order {
  isValid(): boolean {
    this.checked = true;
    return this.total > 0;
  }
}
```

Correct:

```ts
class Order {
  isValid(): boolean {
    return this.total > 0;
  }

  check(): void {
    this.checked = true;
  }
}
```

## Why there is no autofix

The remedy is renaming the function for what it does, or separating the effect into a command of its own, and both need a choice of name.
