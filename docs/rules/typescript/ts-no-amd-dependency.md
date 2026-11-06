# clean-code-book/ts-no-amd-dependency

Load a module with `import`, not with a `/// <amd-dependency />` directive.

- **Config:** `typescript`
- **Fix:** no
- **Catalog entry:** TS-14 in [`docs/catalog-typescript.md`](../../catalog-typescript.md)

## What the book says

> "You should never use the `amd-dependency` directive … and instead stick to a regular `import` ."

*Programming TypeScript*, Boris Cherny, Appendix E, § Deprecated Directives (bookCTX `programming-typescript` chunk 20).

## What it reports

A `///` comment that is an `amd-dependency` directive, such as `/// <amd-dependency path="legacy" />`, in a TypeScript or a JavaScript file.

It does not report:

- `/// <amd-module … />`, which the book lists among the directives "you are most likely to use";
- `/// <reference … />` directives, which are `@typescript-eslint/triple-slash-reference` in `typescript-extended` (TS-13);
- a `//` or `/* */` comment that only mentions the directive.

## Examples

Incorrect:

```ts
/// <amd-dependency path="legacy" />
```

Correct:

```ts
import "legacy";
```

## Why there is no autofix

The `import` that replaces the directive needs a binding name and a module path in the form the project's module resolution uses, and the directive's `name` attribute is not always a valid binding.
