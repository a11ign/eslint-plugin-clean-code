# clean-code-book/no-concrete-inheritance

Do not extend a concrete class of the project, and do not override its concrete methods.

- **Config:** `recommended-type-checked`
- **Fix:** none
- **Catalog entries:** SOL-05, SOL-06
- **Type information:** required. The rule reads types through typescript-eslint's `projectService`. Without type information it reports nothing.

## What the book says

> "**Don't derive from volatile concrete classes.** This is a corollary to the previous rule, but it bears special mention. In statically typed languages, inheritance is the strongest and most rigid of all the source code relationships, and it should be used with great care."

> "**Don't override concrete functions.** Concrete functions often require source code dependencies. When you override those functions, you do not eliminate those dependencies-indeed, you *inherit* them. To manage those dependencies you should make the function abstract and create multiple implementations."

*Clean Code, 2nd Edition*, chapter 19 The SOLID Principles § Stable Abstractions (bookCTX chunk 27).

## What it reports

- `class A extends B` when `B` is a class declared in the project (not in the TypeScript library or `node_modules`) and is not `abstract` (SOL-05). The report is on `B`.
- a method, getter or setter of `A` that overrides a method or accessor with a body, declared in a project class anywhere up `A`'s chain of base classes (SOL-06). This applies whether `B` is abstract or not: an abstract class's concrete methods are concrete functions too.

It does not report:

- a base class from the TypeScript library or `node_modules`: `Error`, `Map`, `Promise`, a framework's classes. The book calls out "the *volatile* concrete elements of our system", and these are stable. Overriding their methods is not reported either.
- implementing an abstract method, or adding a new one.
- `implements`, which is not inheritance.
- a base whose type is not a class (`any`, a mixin's result).
- constructors, and static methods.

A project's own concrete error class is a project class, so `class NotFound extends AppError` is reported when `AppError` is not abstract. Making `AppError` abstract keeps the hierarchy and ends the report. The book says these rules "are actually more like warnings": a project that wants concrete error hierarchies can turn the rule off for those files.

## Examples

Incorrect:

```ts
class Rectangle {
  area(): number {
    return this.w * this.h;
  }
}

class Square extends Rectangle {
  override area(): number {
    return this.side ** 2;
  }
}
```

Correct:

```ts
abstract class Shape {
  abstract area(): number;
}

class Rectangle extends Shape {
  area(): number {
    return this.w * this.h;
  }
}

class Square extends Shape {
  area(): number {
    return this.side ** 2;
  }
}
```

## Why there is no autofix

Introducing an abstraction is a redesign: making the base class abstract breaks every `new B()`, and introducing an interface changes what each caller depends on.
