# clean-code-book/no-getter-chains

Do not chain getter calls through the objects a getter returns.

- **Config:** `recommended`
- **Fix:** none
- **Catalog entry:** OBJ-02

## What the book says

> "This kind of code is often called a *trainwreck* because it look like a bunch of coupled train cars. Chains of calls like this are generally considered to be sloppy style and should be avoided."

*Clean Code, 2nd Edition*, chapter 12 Objects and Data Structures § Trainwrecks (bookCTX chunk 20).

## What it reports

A getter call made on the result of another getter call, such as the book's `ctxt.getOptions().getScratchDir().getAbsolutePath()`. A chain is reported once, at its last call. A getter call is a call of a method named `get` followed by an uppercase letter, with no arguments. Non-null assertions, type assertions and `?.` do not break a chain.

It does not report:

- `getOr` followed by an uppercase letter (`getOrCreate(key)`, `getOrDefault(k, d)`, `getOrThrow()`): these are not getters. A name such as `getOrder()` is a getter.
- a call with arguments: `registry.getOrCreate(key).getName()` and `document.getSelection().getRangeAt(0)` are not chains of getters.
- field access, as the book allows for data structures: `ctxt.options.scratchDir.absolutePath`.
- a chain broken by a call that is not a getter, or by a property read.

## Examples

Incorrect:

```ts
const outputDir = ctxt.getOptions().getScratchDir().getAbsolutePath();
```

Correct:

```ts
const stream = ctxt.createScratchFileStream(classFileName);
```

## Options

- `chainLength` (integer, at least 2, default `2`): the number of chained getter calls that is reported. The book's example chains three calls and gives no limit; the catalog sets 2 (owner sign-off).

## Why there is no autofix

Splitting the chain into temporaries does not remove the coupling: the code still knows the structure of every object along the chain. The book's remedy, "Tell the Other Guy", moves behaviour into the first object. The book also says: "Whether this is a violation of Demeter depends on whether or not `ctxt` , `Options` , and `ScratchDir` are objects or data structures."
