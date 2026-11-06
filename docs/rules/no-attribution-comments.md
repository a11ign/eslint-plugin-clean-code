# clean-code-book/no-attribution-comments

Delete bylines and `@author` tags; version control records who changed what.

- **Config:** `recommended`
- **Fix:** partial
- **Catalog entry:** CMT-08

## What the book says

> "Source code control systems are very good at remembering who added what, when. There is no need to pollute the code with little bylines."

*Clean Code, 2nd Edition*, chapter 5 Comments § Attributions and Bylines (bookCTX chunk 10).

## What it reports

- an `@author` tag,
- `Added by`, `Created by` or `Modified by` followed by a person, then the end of the line or a date. A person is one or more capitalised words (`Ada Lovelace`, `J. R. Smith`), an email address or an `@handle`. A date may follow after `,`, `on` or in parentheses.

It does not report:

- `// Created by Object.create(null), so it has no prototype`: what follows `by` is code, not a person,
- `// Added by the build step`: lower-case words are not a person,
- issue keys and pull request numbers (`ABC-123`, `#456`). The book says to put them in commit messages, but a pattern like `ABC-123` also matches part numbers, standards (`ISO-8601`) and error codes,
- directive comments (`/*! … */`, `@license` and the others), which no fix may change; a legal header keeps its author line.

## Examples

Incorrect:

```ts
// Created by Ada Lovelace on 2024-01-31
/**
 * @author Ada Lovelace <ada@example.com>
 */
```

Correct: no byline. `git blame` shows who wrote each line.

## Fix

The fix deletes a comment that is only bylines, following the catalog's "How fixes stay safe": a comment alone on its lines goes with them, a block comment between `return` and its value becomes a line break, and a comment with code on both sides becomes one space.

It does not apply, and the rule reports without a fix, when the comment has any other text (a doc comment with a description and an `@author` tag, or `// This cache was created by Ada Lovelace`). Deleting the comment would lose that text, and which words belong to the byline is not always clear.
