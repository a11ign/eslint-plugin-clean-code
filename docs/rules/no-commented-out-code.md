# clean-code-book/no-commented-out-code

Delete commented-out code; version control keeps it.

- **Config:** `recommended`
- **Fix:** yes
- **Catalog entry:** CMT-11

## What the book says

> "Few practices are as odious as commenting-out code. Commented-out code is an abomination before nature and nature's God. Don't check this stuff in!"

*Clean Code, 2nd Edition*, chapter 5 Comments § Commented-Out Code (bookCTX chunk 10).

## What it reports

A comment, or a run of line comments on consecutive lines (each alone on its line), whose text parses as one or more JavaScript statements, when:

- the first statement is not a labelled statement, so prose such as `Note: call(x)` or a URL (`https://…` reads as the label `https`) is never code, and
- the text has code syntax: a `;`, a brace, a call (or `new`), or an assignment (`=`, `+=` and the rest). A single word, a list of words or a parenthesised aside is not code.

The text is parsed with `espree` as an ES module, then as JSX, then as a script that allows a top-level `return` (a commented-out function body). In a block comment whose lines all start with `*`, the `*` decoration is taken off first. A run of line comments is read as one text, so a commented-out `if` block over several lines is one report.

It does not check:

- doc comments (`/** … */`) and comments with an `@example` section, which hold examples on purpose,
- directive comments (`eslint-*`, `@ts-*`, `#__PURE__`, `/*! … */` and the others in the catalog's "How fixes stay safe"); a directive line also ends a run,
- a comment that starts with `TODO` or `FIXME`, which `no-warning-comments` reports (CMT-10); it also ends a run, so code on the lines after it is still reported.

A run is read as a whole. A run that mixes prose and code (`// Old version:` then `// run();`) does not parse, so it is not reported: reporting one line of it would let the fix delete a line out of the middle of a sentence. TypeScript-only syntax (`// const x: number = 1;`) does not parse as JavaScript, so it is not reported either.

## Examples

Incorrect:

```ts
function total(items: Item[]): number {
  // const tax = items.length * 0.2;
  // return sum(items) + tax;
  return sum(items);
}
```

Correct:

```ts
function total(items: Item[]): number {
  return sum(items);
}
```

These are not reported:

```ts
// Note: call(init) before anything else.
// We retry once because the proxy drops the first request after a deploy.
// TODO(ada)
// eslint-disable-next-line no-console
```

## Fix

The fix deletes the comment, or every line of the run. Deleting never changes how the code around it parses:

- a comment alone on its lines goes with its lines, so a `;[1, 2].forEach(f)` line after it keeps its leading `;`,
- a block comment that holds a line break and has code beside it becomes a line break, so `return /* … \n … */ 42` still returns `undefined`,
- a comment with code on both sides on one line becomes one space, so `return/*g()*/value` becomes `return value`,
- a comment with code only before it goes with the blank space before it.
