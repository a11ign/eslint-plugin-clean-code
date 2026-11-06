# clean-code-book/no-overloaded-constructors

Use named static factory methods instead of overloaded constructors.

- **Config:** `recommended`
- **Fix:** none
- **Catalog entry:** NAM-13

## What the book says

> "When such constructors are overloaded, it is better to use static factory methods with names that describe the arguments."

*Clean Code, 2nd Edition*, chapter 4 Meaningful Names § Method Names (bookCTX chunk 8).

## What it reports

A TypeScript class with more than one constructor overload signature. The implementation signature is not counted, so a class with one overload signature and its implementation is not reported.

## Examples

Incorrect:

```ts
class Complex {
  constructor(real: number);
  constructor(text: string);
  constructor(value: number | string) {
    this.real = Number(value);
  }
}
```

Correct:

```ts
class Complex {
  static fromRealNumber(real: number): Complex {
    return new Complex(real);
  }

  static parse(text: string): Complex {
    return new Complex(Number(text));
  }

  private constructor(private readonly real: number) {}
}
```

## Why there is no autofix

Each factory method needs a name that describes its arguments, and every `new` call in the project has to change to call it. Neither can be decided from the syntax.
