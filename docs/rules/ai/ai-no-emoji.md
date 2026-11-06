# clean-code-book/ai-no-emoji

Keep emoji out of comments, strings and log messages.

- **Config:** `ai`
- **Fix:** no
- **Catalog entry:** AI-04 in [`docs/catalog-ai.md`](../../catalog-ai.md)

## The AI pattern

Generated code decorates log messages and comments with emoji: `logger.info("✅ Invoices exported 🚀")`, `// 🔥 hot path`. An emoji carries no information a word would not. It makes logs harder to search and grep, and terminals and log viewers without the font show it as a box.

**Language basis:** universal. Logs, comments and source files are read with the same tools in every language, and an emoji is decoration in all of them.

## What it reports

Each emoji in a comment, a string literal or a template literal, one report per emoji. An emoji is:

- a character shown as an emoji by default (Unicode's `Emoji_Presentation`, such as `✅`, `🚀`, `✨`),
- a pictographic character followed by U+FE0F, which asks for emoji presentation (`⚠️`),
- a keycap (`1️⃣`) or a flag (`🇬🇧`),

together with any skin-tone modifier and zero-width-joined parts (`👩‍💻` is one emoji).

It does not report:

- arrows and marks such as `→`, `✓` and `✗`, which are not pictographic;
- pictographic characters written without U+FE0F, which show as text: `©`, `™`, `↔`, `✔`;
- an emoji written as an escape (`"\u{1F680}"`), and regular-expression literals;
- JSX text, unless `checkJsxText` is `true`: text a user reads in the UI is a product decision, not a code habit. Strings in JSX attributes are strings and are checked.

## Examples

Incorrect:

```ts
logger.info("✅ Invoices exported 🚀");
// 🔥 hot path
```

Correct:

```ts
logger.info("Invoices exported");
logger.info("Step 1 → Step 2 ✓");
```

## Options

- `checkJsxText` (`boolean`, default `false`): also check JSX text, such as `<h1>🎉 Welcome</h1>`.
- `allow` (`string[]`, default `[]`): emoji to let through, written with or without U+FE0F.

## Why there is no autofix

Deleting an emoji changes a string the program shows or logs, and an emoji may stand for a word (`done`, `failed`, `warning`) that should replace it.
