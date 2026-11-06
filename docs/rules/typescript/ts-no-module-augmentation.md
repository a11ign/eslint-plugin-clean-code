# clean-code-book/ts-no-module-augmentation

Wrap a module and export the wrapper, instead of augmenting the module with `declare module "…"`.

- **Config:** `typescript`
- **Fix:** no
- **Catalog entry:** TS-15 in [`docs/catalog-typescript.md`](../../catalog-typescript.md)

## What the book says

> "As noted at the start of this section, it's good practice to avoid this pattern when possible (even though it's cool) because it can make your modules brittle and dependent on load order. Instead, try to use composition so that your module extensions consume the module they're extending, and export a wrapper rather than modifying that module."

*Programming TypeScript*, Boris Cherny, § Modules (bookCTX `programming-typescript` chunk 20).

## What it reports

A `declare module "<specifier>" { … }` whose name is a string, in a file that has an `import` or an `export` (a module). That is the augmentation form the book shows: `import 'react'`, then `declare module 'react'`.

It does not report:

- the same declaration in a file with no `import` or `export`, such as a script-mode `.d.ts` file, which declares the types of an untyped module rather than changing a typed one;
- `declare global { … }`, which the book uses to extend a built-in prototype safely;
- `declare module Orders { … }` or `namespace Orders { … }`, whose name is an identifier.

## Where this departs from the book

The book says of augmentation that "it doesn't matter whether our extension file is in module mode or script mode", so a script-mode file can augment a module too. From the syntax alone, the rule cannot tell that from an ambient declaration of an untyped module, and leaves both alone.

## Examples

Incorrect:

```ts
import type { User } from "./user";

declare module "express" {
  interface Request {
    user: User;
  }
}
```

Correct:

```ts
import type { Request } from "express";
import type { User } from "./user";

export interface AuthenticatedRequest extends Request {
  user: User;
}
```

## Why there is no autofix

The replacement is a wrapper module, and its name and its callers are a design change.
