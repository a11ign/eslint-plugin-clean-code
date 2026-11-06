# clean-code-book/no-subtype-check

Do not test whether a value is a particular subtype of its declared type.

- **Config:** `recommended-type-checked`
- **Fix:** none
- **Catalog entry:** SOL-03
- **Type information:** required. The rule reads types through typescript-eslint's `projectService`. Without type information it reports nothing.

## What the book says

> "The only way to defend against this kind of LSP violation is to add mechanisms to the `User` (such as an `if` statement) that detect whether the `Rectangle` is, in fact, a `Square` . Since the behavior of the `User` depends on the types it uses, those types are not substitutable."

*Clean Code, 2nd Edition*, chapter 19 The SOLID Principles § LSP (bookCTX chunk 26).

## What it reports

`x instanceof S` when the declared type of `x` is a class or interface `T` declared in the project (not in the TypeScript library or `node_modules`) and `S` is a proper subtype of `T`: a class that extends or implements `T`, directly or through other types. The declared type is the variable's, parameter's or field's own type (with `null` and `undefined` removed), not the type it is narrowed to, so each check of an `else if` chain is judged against the same `T`.

It does not report:

- a discriminated union's tag check (`shape.kind === "circle"`, `switch (shape.kind)`): that is a data structure's tag, not a subtype test.
- a check against the declared type itself, or against a type unrelated to it.
- a value declared `unknown`, `any` or as a union, which has no single supertype: `catch (error) { if (error instanceof SyntaxError) … }` is not reported.
- a library supertype: `e: Error` tested with `instanceof TypeError` or a project `AppError`.

## Examples

Incorrect:

```ts
function resize(r: Rectangle) {
  if (r instanceof Square) return;
  r.setWidth(2);
}
```

Correct:

```ts
interface Resizable {
  resize(width: number): void;
}

function resize(shape: Resizable) {
  shape.resize(2); // each subtype decides what resizing means
}

type Shape = { kind: "circle"; r: number } | { kind: "square"; side: number };
function area(shape: Shape) {
  return shape.kind === "circle" ? Math.PI * shape.r ** 2 : shape.side ** 2;
}
```

## Why there is no autofix

The varying behaviour has to move into the subtypes, as a method that each one implements. Which method, and what each subtype does in it, are design decisions.
