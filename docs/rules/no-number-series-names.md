# clean-code-book/no-number-series-names

Make meaningful distinctions: no bindings in one scope that differ only by a trailing number (`list1`, `list2`).

- **Config:** `recommended`
- **Fix:** none
- **Catalog entry:** NAM-04

## What the book says

> "Number-series naming ( `a1` , `a2` , ... `aN` ) is the opposite of intentional naming. Such names are not dis-informative, they are uninformative; they provide no clue to the author's intention."

*Clean Code, 2nd Edition*, chapter 4 Meaningful Names § Make Meaningful Distinctions (bookCTX chunk 8).

## What it reports

Two or more bindings declared in one scope that share a stem and differ only by a trailing number, with or without an underscore before it (`list1` and `list2`, `value_1` and `value_2`). A binding named with the bare stem counts as a member of the series (`result` and `result2`), but only the numbered names are reported. Every kind of binding counts: variables, parameters, functions, classes and imports.

It does not report:

- one-letter stems, because the book accepts ordered coordinates: "it is not hard to keep the arguments of `distance(x1,y1,x2,y2)` in order" (chunk 13);
- names whose last word is a term with digits in it, which do not form a series: `sha1` and `sha256`, `utf8` and `utf16`, `base64`, `int32`, `es2015`, `ipv4`, `http2` and the like;
- numbered names in different scopes, or with different stems;
- property names, which are not bindings.

## Examples

Incorrect:

```ts
function copyChars(chars1: string[], chars2: string[]): void {
  for (let i = 0; i < chars1.length; i++) chars2[i] = chars1[i];
}
```

Correct:

```ts
function copyChars(source: string[], destination: string[]): void {
  for (let i = 0; i < source.length; i++) destination[i] = source[i];
}
```

## Why there is no autofix

It needs a name that says what each value is, which the syntax cannot tell.
