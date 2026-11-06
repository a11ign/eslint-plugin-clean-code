# clean-code-book/no-position-markers

Remove banner comments made of long runs of punctuation.

- **Config:** `recommended`
- **Fix:** yes
- **Catalog entry:** CMT-07

## What the book says

> "There are rare times when it makes sense to gather certain functions together beneath a banner like this. But in general, they are clutter that should be avoided-especially the noisy train of slashes at the end."

*Clean Code, 2nd Edition*, chapter 5 Comments § Position Markers (bookCTX chunk 10).

## What it reports

A comment containing a run of 5 or more of one punctuation character: `/`, `*`, `-`, `=` or `#`.

These are not runs:

- JSDoc's opening `/**`: the `*` after `/*` never counts, so `/*****` is a run of 4,
- an arrow: a run followed by `>` or preceded by `<` (`[A] -----> [B]`, `<=====`),
- in a doc comment, a line made only of a run that directly underlines a line of text (a Markdown heading), and a Markdown table rule (`| ----- | ----- |`) under a table row.

Directive comments (`/*! … */`, `@license` and the others) are not reported, because no fix may change them.

## Examples

Incorrect:

```ts
// Actions //////////////////////////////////

/*******************
 * Helpers
 *******************/
```

Correct:

```ts
// Actions

/*
 * Helpers
 */
```

Better still, let the names and the order of the functions show that they belong together, or move them into their own module.

## Options

The shortest run that counts, `5` by default:

```js
"clean-code-book/no-position-markers": ["error", 8]
```

## Fix

The fix removes each run and the blank space around it, keeping one space between text on both sides and between text and the comment's delimiters (`/********** Section **********/` becomes `/* Section */`). A line left with no text is removed. When the comment then has no text at all, the fix deletes it, following the catalog's "How fixes stay safe": a comment alone on its lines goes with them, so a `;[1, 2]` line after it keeps its `;`; a block comment between `return` and its value becomes a line break; and `return/*=====*/value` becomes `return value`.

It does not apply when the new text would change what the comment is: end it early (`*/`), turn a plain block comment into a doc comment (`/**`), turn a line comment into a triple-slash directive, or make it a directive comment. Because a space is kept between text on both sides of a run, `*=====/` becomes `* /`, not `*/`.
