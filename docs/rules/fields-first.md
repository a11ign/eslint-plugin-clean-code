# clean-code-book/fields-first

Declare a class's fields together, above its constructor, methods and accessors.

- **Config:** `recommended`
- **Fix:** yes (partial)
- **Catalog entry:** FMT-03

## What the book says

> "The important thing is for the instance variables to be declared in one well-known place. Everybody should know where to go to see the declarations."

*Clean Code, 2nd Edition*, chapter 6 Formatting § Variable Declarations (bookCTX chunk 11).

## What it reports

A class field (instance or static, public, private or `#private`, abstract or not) declared after the class's first constructor, method, getter, setter, auto-accessor (`accessor x`) or `static {}` block. Fields go first, which is the JavaScript and TypeScript convention, so a reader always knows where to look.

It does not report an index signature (`[key: string]: unknown`), which declares no variable, or fields that are all above the first other member.

## Examples

Incorrect:

```ts
class Counter {
  increment(): number {
    this.count += 1;
    return this.count;
  }

  count = 0;
}
```

Correct:

```ts
class Counter {
  count = 0;

  increment(): number {
    this.count += 1;
    return this.count;
  }
}
```

## Fix

The fix moves every misplaced field, with the comments attached to it, to just above the first constructor, method or accessor, keeping the fields in the same order relative to each other. Field initializers run in the order the fields are declared, and that order does not change. Methods are defined on the class before any field is initialised, wherever they are written, so moving a field past them changes nothing at runtime.

The move follows the catalog's "How fixes stay safe": a moved field without a `;` gets one when the member after its new place would otherwise continue it (`size = 0` followed by `[Symbol.iterator]() {}`, by a generator method `*values() {}`, or by a method named `in` or `instanceof`); a moved field that would continue the field without `;` above its new place gets a `;` in front (`;instanceof = 2`); and in code without semicolons, a removed field leaves a `;` when the member after it would otherwise continue the code before it.

There is no fix, and the rule only reports, when the class has any of these, because each runs in source order and the move would change that order:

- a moved field with a computed key (`[k()] = 1`). A computed key is evaluated when the class is defined, in source order with the computed keys of methods.
- a decorator on any member.
- a `static {}` block, which runs in order with the static field initializers.
- an auto-accessor (`accessor x = 1`), whose storage is initialised in order with the fields and whose getter and setter are defined in order with the methods.
- a field initializer that refers to the class, by its name or, in a static field, through `this`.

There is also no fix when a field, or the member it would move above, shares its line with other code, and when a directive comment lies between a field's old place and its new one (`/* eslint-disable */`, `// c8 ignore start`, `/* istanbul ignore next */`), since the move would take the field into or out of what the directive covers.
