# clean-code-book/no-protected-fields

Avoid `protected` fields: they let code in other files, in subclasses, depend on a class's variables.

- **Config:** `recommended`
- **Fix:** none
- **Catalog entry:** FMT-02

## What the book says

> "But then closely related concepts should not be separated into different files unless you have a very good reason. Indeed, this is one of the reasons that `protected` variables should be avoided."

*Clean Code, 2nd Edition*, chapter 6 Formatting § Vertical Distance (bookCTX chunk 11).

## What it reports

A TypeScript field declared `protected`: a property (static, `readonly` or `abstract` too), an auto-accessor (`protected accessor x`), which holds a variable behind its getter and setter, and a constructor parameter property (`constructor(protected name: string)`).

It does not report protected methods, getters, setters or constructors, because the book's reason is about variables, nor `private`, `#private` or public fields.

## Examples

Incorrect:

```ts
class Account {
  protected balance = 0;
}

class SavingsAccount extends Account {
  addInterest(rate: number): void {
    this.balance *= 1 + rate;
  }
}
```

Correct:

```ts
class Account {
  private balance = 0;

  protected applyRate(rate: number): void {
    this.balance *= 1 + rate;
  }
}

class SavingsAccount extends Account {
  addInterest(rate: number): void {
    this.applyRate(rate);
  }
}
```

## Why there is no autofix

Making the field `private` breaks the subclasses that use it, and making it public widens access. The remedy, a method that says what the subclasses need, has to be designed and named.
