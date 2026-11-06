# clean-code-book/no-hybrid-class

A class is either an object (hidden data, public behaviour) or a data structure (public data, no behaviour), not both.

- **Config:** `recommended`
- **Fix:** none
- **Catalog entry:** OBJ-04

## What the book says

> "Such hybrids make it hard to add new functions but also make it hard to add new data structures. They are the worst of both worlds. Avoid creating them."

*Clean Code, 2nd Edition*, chapter 12 Objects and Data Structures § Hybrids (bookCTX chunk 20).

## What it reports

A class that has both a public mutable field and a method with behaviour. The book's convention is: "data structures had public variables and no functions, whereas objects had private variables and public functions".

- A public mutable field is an instance field declaration, a TypeScript `public` parameter property, or a `this.x =` assignment in the constructor to a field the class does not declare, without `private`, `#`, `protected` or `readonly`.
- A method has behaviour unless it is the constructor, a `get` or `set` accessor, or a method whose every `return` returns `this`. A method with no `return` has behaviour. A field initialised with a function counts as a method.

It does not report:

- a fluent builder (`limit = 10; setLimit(n) { this.limit = n; return this; }`): its methods are setters, not behaviour;
- `static` members, which belong to the class and not to its instances;
- a data structure with only public fields, or an object with only private fields.

## Examples

Incorrect:

```ts
class Rectangle {
  width = 0;
  height = 0;

  area(): number {
    return this.width * this.height;
  }
}
```

Correct:

```ts
class Rectangle {
  constructor(private readonly width: number, private readonly height: number) {}

  area(): number {
    return this.width * this.height;
  }
}
```

## Why there is no autofix

Choosing whether the class becomes an object or a data structure is a design decision: hiding the fields breaks the code that reads them, and moving the behaviour out changes every caller.
