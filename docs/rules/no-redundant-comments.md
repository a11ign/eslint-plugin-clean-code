# clean-code-book/no-redundant-comments

Delete doc comments and `@param` tags that only restate the name.

- **Config:** `recommended`
- **Fix:** yes
- **Catalog entry:** CMT-03, CMT-04, CMT-05

## What the book says

> "Sometimes you see comments that are nothing but noise. They restate the obvious and provide no new information."

*Clean Code, 2nd Edition*, chapter 5 Comments § Redundant Comments, § Noise Comments (bookCTX chunk 10). On mandated comments (CMT-04, § Mandated Comments): "It is just plain silly to have a rule that says that every function must have a Javadoc, or every variable must have a comment." On function headers (CMT-05, § Function Headers): "A well-chosen name and signature for a small function that does one thing is *usually* better than a comment header."

## What it reports

- A doc comment (`/** … */`) with no tags (no `@` at all) directly above a declaration, when every content word of the comment is a word of the declaration's name. Stop words (`the`, `a`, `an`, `this`, `of`, `for`, `to`) and the accessor verbs `returns`, `gets` and `sets` are ignored. A constructor's words are `default`, `constructor` and its class's name, so "Default constructor." is reported. The declarations are functions, classes, interfaces, type aliases, enums and their members, single-variable declarations, class members, interface members and object-literal properties.
- A `@param` tag with no `{type}` whose description is empty or only the parameter's name split into words (`@param title The title`, `@param firstName - The first name`).

It does not report:

- `/** The processor delay for this component */` on `backgroundProcessorDelay`. The book calls this exact comment clutter, but "component" is not in the name. Once one word is outside the name, the rule cannot tell an obvious word from real information, and its fix deletes the comment.
- a doc comment with any tag, block or inline (`@internal`, `@deprecated`, `{@link …}`), because tags can change what tools do,
- a doc comment with no content words, a plain block comment, a line comment, or a doc comment that is not directly above a declaration,
- a `@param` with a `{type}`, which in a JavaScript file under `checkJs` is the parameter's type, or with an optional name or default (`@param [title=Untitled]`),
- directive doc comments (`@license`, `@jsx` and the others).

## Examples

Incorrect:

```ts
class Day {
  /** Returns the day of the month. */
  getDayOfMonth(): number { … }
}

/**
 * Adds a CD to the shelf.
 * @param title The title
 * @param author The author
 */
function addCd(title: string, author: string) { … }
```

Correct:

```ts
class Day {
  getDayOfMonth(): number { … }
}

/**
 * Adds a CD to the shelf.
 */
function addCd(title: string, author: string) { … }
```

## Fix

For a redundant doc comment, the fix deletes it, following the catalog's "How fixes stay safe": a comment alone on its lines goes with them, a comment with code on both sides on one line becomes one space, and one that holds a line break with code beside it becomes a line break.

For redundant `@param` tags, the fix deletes each tag's lines (with its continuation lines) and the blank lines they would leave before the comment's end. If the doc comment then holds nothing, or holds only a description that restates the declaration's name, the fix deletes the whole comment, so the fixed code is not reported again. The first `@param` report carries the fix for every redundant tag in the comment.
