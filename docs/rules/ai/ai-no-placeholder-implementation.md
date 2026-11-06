# clean-code-book/ai-no-placeholder-implementation

Don't ship a function whose body is only a placeholder: `throw new Error("Not implemented")` or a stub return.

- **Config:** `ai`
- **Fix:** no
- **Catalog entry:** AI-03 in [`docs/catalog-ai.md`](../../catalog-ai.md)

## The AI pattern

Generated code completes a shape and leaves the inside unfinished: `throw new Error("Not implemented")`, or `return null; // TODO`. The stub compiles, type-checks and looks finished in a diff, and fails only when it is called.

**Language basis:** universal. A placeholder body is a placeholder in any language.

## What it reports

A function, method or arrow function whose body is a single statement, either:

- `throw new <…Error>(message)` or `throw <…Error>(message)`, where the message is a string matching `/not (yet )?implemented|todo|implement (me|this)|stub/i`;
- a `return` of `null`, `undefined`, `{}`, `[]` or `""`, with a comment inside the body that matches the same pattern.

It does not report:

- `abstract` methods and interface method signatures, which have no body;
- methods of a class whose name ends in `Stub`, `Fake` or `Mock`;
- test files (`*.test.*`, `*.spec.*` and files under `__tests__/`), where the `ai` config turns the rule off;
- a bare `return null` with no stub comment, which is often a real answer.

## Examples

Incorrect:

```ts
export function exportInvoices(): void {
  throw new Error("Not implemented");
}

export function loadSettings(): Settings | null {
  // TODO: read from disk
  return null;
}
```

Correct: the implementation, or no function until one is needed. A stand-in for tests:

```ts
class MailerFake implements Mailer {
  send(): void {
    throw new Error("Not implemented");
  }
}
```

## Why there is no autofix

The rule cannot write the implementation, and deleting the function breaks its callers.
