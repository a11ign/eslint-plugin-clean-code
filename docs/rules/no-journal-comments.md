# clean-code-book/no-journal-comments

Delete change-log comments; version control keeps the history.

- **Config:** `recommended`
- **Fix:** yes
- **Catalog entry:** CMT-06

## What the book says

> "Nowadays, however, these long journals are just more clutter to obfuscate the module. They should be completely removed. Let the source code control system keep the journal for you."

*Clean Code, 2nd Edition*, chapter 5 Comments § Journal Comments (bookCTX chunk 10).

## What it reports

A comment in which at least 3 lines start with a date followed by `:` or `-`, which makes it a change log. The dates it knows are `2024-01-31`, `31-Jan-2024` and `1/31/2024`. A run of line comments on consecutive lines counts as one comment.

It does not report:

- one or two dated lines, which are usually an "as of" note, not a journal,
- a date that is not at the start of its line (`Released on 2024-01-01: …`), or a date not followed by `:` or `-`,
- dated lines in separate comments,
- directive comments (`/*! … */`, `@license` and the others), which no fix may change.

## Examples

Incorrect:

```ts
/*
 * Changes (from 11-Oct-2001)
 * 11-Oct-2001 : Re-organised the class and moved it to new package
 *               com.jrefinery.date (DG);
 * 05-Nov-2001 : Added a getDescription() method, and eliminated NotableDate
 *               class (DG);
 * 12-Nov-2001 : IBD requires setDescription() method, now that NotableDate
 *               class is gone (DG);
 */
```

Correct: no comment. `git log` holds every change, its date and its author.

## Options

The number of dated lines that makes a journal, `3` by default:

```js
"clean-code-book/no-journal-comments": ["error", 5]
```

## Fix

The fix deletes each dated line together with the lines that continue its entry: the lines directly after it that are indented further than its date and are not dated themselves. Other lines, such as a heading, stay. When nothing with text is left, the fix deletes the whole comment, following the catalog's "How fixes stay safe": a comment alone on its lines goes with them, so a `;[1, 2]` line after it keeps its `;`, and a block comment between `return` and its value becomes a line break.
