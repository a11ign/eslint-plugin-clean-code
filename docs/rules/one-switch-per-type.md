# clean-code-book/one-switch-per-type

Switch at most once on a class's own type code.

- **Config:** `recommended`
- **Fix:** none
- **Catalog entry:** OBJ-05

## What the book says

> "Thus, my general rule for `switch` statements and their ugly duckling sibling, `if` / `else` chains, is that they should be located at the periphery of the system (e.g., the `main` module); there should be, at most, one for each switchable type; and the cases within them must create the polymorphic objects that the rest of the system uses."

*Clean Code, 2nd Edition*, chapter 12 Objects and Data Structures § The OO/Procedural Trade-off (bookCTX chunk 20); see also chapter 7 Clean Functions § Switch Statements.

## What it reports

The second and every later `switch`, within one class, on the same type code of the object itself. A type code is a member of `this` named `type`, `kind` or `typeCode`, or ending in `Type` or `Kind` (`this.type`, `this.shapeKind`, `this.#accountType`), also when `this` is behind a type assertion or `!` (`(this as Shape).kind`). That is the book's case: an object whose behaviour varies by a type field. The threshold is 1, the book's "at most, one for each switchable type".

`this` is followed as JavaScript binds it: a switch in an arrow function inside a method counts for the class, and one in a nested `function` does not. A static type code and an instance one are different members.

It does not report:

- a `switch` over anything other than a type code of `this`, including a discriminated union passed as data (`switch (shape.kind)` in two functions). The book: "Sometimes you really do want simple data structures with procedures operating on them". The procedural choice is right "in those parts of the system where behavior is overwhelmingly more volatile than data".
- a `switch` on a state field such as `this.state`, which changes over the object's life and is not its type;
- `if`/`else` chains, which this rule does not check.

## Examples

Incorrect:

```ts
class Employee {
  type: "engineer" | "manager" = "engineer";

  pay(): number {
    switch (this.type) {
      case "engineer": return 1000;
      case "manager": return 2000;
    }
  }

  duties(): string {
    switch (this.type) {
      case "engineer": return "code";
      case "manager": return "plan";
    }
  }
}
```

Correct:

```ts
interface Employee {
  pay(): number;
  duties(): string;
}

function makeEmployee(type: "engineer" | "manager"): Employee {
  switch (type) {
    case "engineer": return new Engineer();
    case "manager": return new Manager();
  }
}
```

## Why there is no autofix

Replacing the switches with polymorphism is a redesign: it introduces an interface, one class per case and a factory, which the syntax cannot decide.
