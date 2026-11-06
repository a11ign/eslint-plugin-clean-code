# clean-code-book/ai-no-inline-comments

Say it in the code, not in a `//` or `/* */` comment: only `/** */` doc comments and tool directives stay.

- **Config:** `ai`
- **Fix:** no
- **Catalog entry:** AI-01 in [`docs/catalog-ai.md`](../../catalog-ai.md)

## The AI pattern

Generated code narrates itself: a comment above each step says what the next line does (`// Loop through the users`). The comment repeats the code, goes stale when the code changes, and hides that the step wants a name of its own.

*Clean Code, 2nd Edition* supports this, in chapter 5 Comments § Comments Do Not Make Up for Bad Code (bookCTX chunk 9): "Clear and expressive code with few comments is far superior to cluttered and complex code with lots of comments."

**Language basis:** universal. Every language lets a name or a function say what a comment says.

## What it reports

Every `//` and `/* */` comment that is not a `/** */` doc comment. The rule is strict on purpose: it does not guess which comments narrate, so what it reports is predictable. The message quotes the comment and points to where its content belongs: a clearer name, an extracted function, a JSDoc on the declaration, or a doc file.

It does not report:

- `/** */` doc comments;
- tool directives: `eslint-*`, `oxlint-*`, `@ts-*`, `/// <reference …>`, `prettier-ignore`, `istanbul` and `c8`, `webpack…:` magic comments, `@vite-ignore`, `#__PURE__` and `@__PURE__`, `global`, `/*! … */`, `@license`, `biome-ignore`, `#region` and the other comments tools read;
- the hashbang (`#!/usr/bin/env node`);
- a licence header: the first comment of the file, before any code, that names a copyright, a licence or an SPDX identifier;
- a comment matching one of the `allow` regular expressions.

## Examples

Incorrect:

```ts
// Loop through the users
for (const user of users) {
  // Send them an email
  send(user.email);
}
```

Correct:

```ts
for (const user of users) notifyByEmail(user);
```

```ts
/** Returns the invoice total, rounded to cents. */
export function invoiceTotal(invoice: Invoice): number {
  // eslint-disable-next-line no-restricted-syntax
  return roundToCents(sum(invoice.lines));
}
```

## Options

- `allow` (`string[]`, default `[]`): regular expressions, tested against the comment's text (without `//` or `/* */`). A comment that matches one is not reported. For example, to keep comments that explain why:

```js
{ "clean-code-book/ai-no-inline-comments": ["error", { allow: ["^ ?WHY:"] }] }
```

## Why there is no autofix

Deleting a comment can lose information that belongs somewhere else: in a name, a JSDoc, or a doc file. Where it goes is a person's decision, so `--fix` leaves every comment in place.
