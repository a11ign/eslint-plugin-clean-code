# clean-code-book/no-mutable-static-state

Methods share state through instance fields, not through static fields they assign.

- **Config:** `recommended`
- **Fix:** none
- **Catalog entry:** ONE-05

## What the book says

> "The bottom line is that sometimes when we extract functions, it is convenient and clean to allow those functions to communicate through variables in the scope (the class) that contains them."

*Clean Code, 2nd Edition*, chapter 10 One Thing § Extraction and Classes (bookCTX chunk 19). The book's caveat is the reason for this rule: "Those static variables could get corrupted in a multithreaded environment. This is easy enough to correct by changing all the functions and variables from `static` to instance methods and variables."

## What it reports

A `static` class field that a method of the same class assigns to: an assignment, a compound assignment, `++`/`--` or `delete`, through the class name (`Counter.count`, `Cache.#hits`) or through `this` in a static method. Methods include the constructor, accessors and fields initialised with a function, and any arrow function or callback inside them. Each field is reported once, at its declaration.

It does not report:

- a static field that is only read, such as a constant;
- a static field set in its initialiser or in a `static` block, which runs once when the class is defined;
- changes to the object a static field holds (`Registry.items.push(x)`), which do not assign the field;
- a static field of another class, and `this` inside a nested `function`, which is not the class.

## Examples

Incorrect:

```ts
class PrimePrinter {
  static numberOfPrimes = 0;

  static main(): void {
    PrimePrinter.numberOfPrimes = 1000;
    PrimePrinter.printPrimes();
  }
}
```

Correct:

```ts
class PrimePrinter {
  numberOfPrimes = 0;

  run(): void {
    this.numberOfPrimes = 1000;
    this.printPrimes();
  }
}

new PrimePrinter().run();
```

## Why there is no autofix

Turning static members into instance members changes every caller (`Class.member` becomes `instance.member`) and how many copies of the state exist.
