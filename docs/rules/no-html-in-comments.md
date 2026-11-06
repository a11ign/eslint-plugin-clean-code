# clean-code-book/no-html-in-comments

Write comments as plain text, without HTML tags or entities.

- **Config:** `recommended`
- **Fix:** partial
- **Catalog entry:** CMT-09

## What the book says

> "If comments are going to be extracted by some tool (like Javadoc) to appear in a nicely formatted document, then it should be the responsibility of that tool, and not the programmer, to adorn the comments with appropriate formatting."

*Clean Code, 2nd Edition*, chapter 5 Comments § HTML Comments (bookCTX chunk 10).

## What it reports

In any comment:

- the formatting tags `p`, `br`, `pre`, `code`, `b`, `i`, `em`, `strong`, `tt`, `ul`, `ol` and `li`, opening, closing or self-closing, with or without attributes,
- the entities `&lt;`, `&gt;`, `&amp;`, `&quot;`, `&#39;` and `&nbsp;`.

It does not report:

- other angle-bracket text, such as a JSX example (`<Button onClick={go}>`) or a comparison,
- tags in upper case: `<T>`, `<B>`, `<I>` and `<P>` are type parameters (`Map<K, V>`, `List<I>`), not HTML,
- HTML inside code: an `@example` section, a fenced code block (```` ``` ````) or a backtick span (`` `<b>` ``),
- a bare `&` (`R&D`, `a && b`),
- directive comments (`/*! … */`, `@license` and the others), which no fix may change.

## Examples

Incorrect:

```ts
/**
 * Returns the <b>first</b> visible item.
 * <p>
 * Use it when a &lt; b.
 */
```

Correct:

```ts
/**
 * Returns the **first** visible item.
 *
 * Use it when a < b.
 */
```

## Fix

The fix removes the tags, keeping the text between them, and decodes the entities (`&nbsp;` becomes a plain space). A tag that breaks a line or a block (`p`, `br`, `pre`, `ul`, `ol`, `li`) between two words leaves one space, so `one<br>two` becomes `one two`. Blank space left at the end of a changed line is trimmed. A comment left with no text is deleted, following the catalog's "How fixes stay safe".

It works one level at a time, and does not apply, so the rule reports without a fix, when:

- the decoded text would be HTML again: a double-escaped entity (`&amp;lt;`) or an escaped tag (`&lt;b&gt;`). A second `--fix` would decode it again, and an escaped tag is often meant to be read as text,
- the new text would end the comment early (`*/`) or change what kind of comment it is (a doc comment, a directive).
