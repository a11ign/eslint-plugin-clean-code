# Catalog: the `ai` config, rules for the habits of AI-generated code

This catalog is the specification for the rules of the opt-in `ai` config. It is separate from [`docs/catalog.md`](catalog.md), which requires a passage of *Clean Code, 2nd Edition* for every rule. These rules are justified by a habit that AI-generated JavaScript and TypeScript shows, and by the harm that habit does. A book passage is cited where one supports the rule, but it is not required. [ADR 0003](adr/0003-ai-config-separate-from-book-rules.md) records why the rules are a separate config in the same package rather than part of `recommended` or a second package.

Each entry gives:

- **Rule**: the rule's name, `clean-code-book/ai-<name>`.
- **AI pattern**: the habit, as it shows up in generated code.
- **Harm**: what the habit costs the people who maintain the code.
- **Book**: a supporting passage, where there is one. It cites the book `clean-code-a-handbook-of-agile-software-craftsmanship-second-edition` (or the book named) in the bookCTX library, at the chunk named.
- **Language basis**: *universal* when the reasoning holds in any language, or *JS/TS-specific* when it rests on how JavaScript and TypeScript work, with the reason. A rule that contradicts a book example says why in its doc page, under "Where this departs from the book".
- **Reports** and **Does not report**.
- **Fix**: none of these rules has an autofix. Each entry says why.

Every rule in `ai` is set to `error`. The config stands alone: use it after `recommended` (`[...recommended, ...ai]`) or on its own. `recommended` and `recommended-type-checked` do not turn on any `ai-` rule.

## The rule set at a glance

| Rule | Entry | Config | Fix |
| --- | --- | --- | --- |
| `ai-no-inline-comments` | AI-01 | ai | no fix |
| `ai-no-ceremonial-catch` | AI-02 | ai | no fix |
| `ai-no-placeholder-implementation` | AI-03 | ai | no fix |
| `ai-no-emoji` | AI-04 | ai | no fix |
| `ai-no-placeholder-values` | AI-05 | ai | no fix |

## Entries

#### AI-01 · Narrating comments

- **Rule:** `ai-no-inline-comments`
- **AI pattern:** a `//` or `/* */` comment above or beside each step, saying what the next line does (`// Loop through the users`, `// Return the result`).
- **Harm:** the comment repeats the code, so it is one more thing to read and to keep in step with the code. When the code changes and the comment does not, it misleads. A comment that explains a step also hides that the step wants a name of its own.
- **Book:** chapter 5 Comments § Comments Do Not Make Up for Bad Code (bookCTX chunk 9): "Clear and expressive code with few comments is far superior to cluttered and complex code with lots of comments." The book's CMT-01 entry rules out a comment-density rule as a *book* rule; this rule is not a density rule, and it is not a book rule.
- **Language basis:** universal. Every language lets a name or a function say what a comment says.
- **Reports:** every `//` and `/* */` comment that is not a `/** */` doc comment. The rule is strict on purpose: a "narration" heuristic would be unpredictable, and a density threshold is what CMT-01 rejected. A regular-expression explanation or a "why" comment is reported too, unless the project lets it through with the `allow` option (for example `"^ ?WHY:"`) or moves it into the declaration's JSDoc.
- **Does not report:**
  - `/** */` doc comments, which document an API and which tools read;
  - tool directives: `eslint-*`, `oxlint-*`, `@ts-*`, `/// <reference …>`, `prettier-ignore`, `istanbul` and `c8`, `webpack…:` magic comments, `@vite-ignore`, `#__PURE__` and `@__PURE__`, `global`, and the rest of what `isDirectiveComment` in `src/lib/safe-fix.ts` recognises (`/*! … */`, `@license`, `biome-ignore`, `#region`, `sourceMappingURL` and others);
  - the hashbang;
  - a licence header: the first comment of the file, before any code, that names a copyright, a licence or an SPDX identifier;
  - comments that match one of the `allow` regular expressions.
- **Fix:** no fix. Deleting a comment can lose information that belongs somewhere else, such as a doc file or a JSDoc, and where it goes is a person's decision.

#### AI-02 · Ceremonial catch

- **Rule:** `ai-no-ceremonial-catch`
- **AI pattern:** a `try`/`catch` put around a call by reflex, whose `catch` only logs the error and then rethrows it (`catch (e) { console.error(e); throw e; }`), or only logs it and carries on (`catch (e) { logger.error(e); }`).
- **Harm:** log and rethrow logs the same error twice, once here and once where it is handled, and adds nothing the stack trace did not have. Log and swallow turns a failure into a log line: the caller carries on with a result that was never produced.
- **Book:** *Head First C#* (bookCTX chunk 52): handle your exceptions, don't bury them. *Clean Code 2e* chapter 8 § Extract Try/Catch Blocks (chunk 14) logs and swallows in its `delete()` example; the rule's doc page explains why that example does not carry over to JavaScript and TypeScript.
- **Language basis:** JS/TS-specific. JavaScript and TypeScript have no checked exceptions (*Programming TypeScript*, bookCTX chunk 13), so no compiler forces a function to catch what it calls, and an error that is not caught bubbles up to the boundary that reports it to monitoring (chunk 18). In Java, `throws Exception` forces a catch-or-declare decision at every call, and the book's boundary catch answers that.
- **Reports:**
  - a `catch` whose body is one or more logging calls followed by `throw <the caught parameter>` (log and rethrow);
  - a `catch` whose body is only logging calls (log and swallow), unless `allowSwallow: true`.
  A logging call is a call statement, awaited or not, on `console.*`, or on an identifier or member chain whose last name is `log`, `logger`, `logError`, `warn` or `error`. The `loggerNames` option replaces those names.
- **Does not report:** an empty `catch`, which `no-empty` reports; a `catch` that only rethrows, which ESLint's `no-useless-catch` reports; a `catch` that does anything besides logging, such as returning a fallback, wrapping the error in a new one with `cause`, or throwing something else.
- **Fix:** no fix. Removing the `try`/`catch` changes where the error is logged, and what a swallowing `catch` should do instead is a decision about the program's behaviour.

#### AI-03 · Stub bodies

- **Rule:** `ai-no-placeholder-implementation`
- **AI pattern:** a function written to complete a shape and left unfinished: `throw new Error("Not implemented")`, or `return null; // TODO`.
- **Harm:** the stub compiles, type-checks and looks finished in a diff. It fails only when it is called, often in production, far from the change that left it.
- **Language basis:** universal. A placeholder body is a placeholder in any language.
- **Reports:** a function, method or arrow function whose body is a single statement, either:
  - `throw new <…Error>(message)` (or `throw <…Error>(message)`), where the message is a string matching `/not (yet )?implemented|todo|implement (me|this)|stub/i`;
  - a `return` of `null`, `undefined`, `{}`, `[]` or `""`, with a comment inside the body that matches the same pattern.
- **Does not report:** `abstract` methods and interface signatures, which have no body; methods of a class whose name ends in `Stub`, `Fake` or `Mock`; test files (the `TEST_FILES` of `src/configs.ts`, where the `ai` config turns the rule off).
- **Fix:** no fix. The rule cannot write the implementation, and deleting the function breaks its callers.

#### AI-04 · Emoji in code

- **Rule:** `ai-no-emoji`
- **AI pattern:** emoji used as decoration in log messages, comments and strings: `logger.info("✅ Invoices exported 🚀")`, `// 🔥 hot path`.
- **Harm:** an emoji carries no information a word would not. It makes logs harder to search and grep, and terminals and log viewers without the font show it as a box.
- **Language basis:** universal. Logs, comments and source files are read with the same tools in every language, and an emoji is decoration in all of them.
- **Reports:** each emoji in a comment, a string literal or a template literal. An emoji is a character shown as an emoji by default (Unicode's `Emoji_Presentation`, such as `✅` and `🚀`), a pictographic character followed by U+FE0F (`⚠️`), a keycap or a flag, together with any skin-tone modifier and zero-width-joined parts. JSX text is checked only with `checkJsxText: true`. The `allow` option lists emoji to let through.
- **Does not report:** arrows and marks such as `→` and `✓`, which are not pictographic; pictographic characters written without U+FE0F, which show as text (`©`, `™`, `↔`, `✔`); an emoji written as an escape (`"\u{1F680}"`); regular-expression literals.
- **Fix:** no fix. Deleting an emoji changes a string the program shows or logs, and an emoji may stand for a word that should replace it.

#### AI-05 · Placeholder values

- **Rule:** `ai-no-placeholder-values`
- **AI pattern:** a value left for a person to fill in: `"YOUR_API_KEY"`, `"<insert token>"`, `"your-api-key-here"`, `"changeme"`, `"sk-..."`.
- **Harm:** a placeholder looks like a value, so the code runs. It fails later, at the request that sends it, with an error far from the line that is wrong.
- **Language basis:** universal. A value a person was meant to fill in is missing in any language, and the failure comes at the same place: where it is first used.
- **Reports:** a string literal, or a template literal with no `${…}` parts, that matches any of these, ignoring case: `^your[-_ ].+[-_ ]here$`, `^YOUR_[A-Z_]+$`, `^<(insert|your|enter) .+>$`, `^(replace[-_ ]?me|changeme|xxx+|placeholder)$`, `^sk-(xxx+|\.\.\.)$`. The `patterns` option adds more.
- **Does not report:** strings that name something rather than give a value (a property key, a computed member name such as `el["placeholder"]`, a module specifier, a TypeScript literal type); test files (the `TEST_FILES` of `src/configs.ts`, where the `ai` config turns the rule off). This rule is not a secret scanner: hardcoded real credentials are out of its scope.
- **Fix:** no fix. The real value is not in the code, and reading it from configuration is a change to how the program starts.

## Not in this config, and where it goes instead

- **Generic names** (`data`, `result`, `temp`, `handleData`): `no-noise-words` in `recommended` (NAM-08, NAM-11).
- **Over-defensive checks** (`if (x !== null && x !== undefined)` on a value that cannot be null): typescript-eslint's `no-unnecessary-condition`, which needs type information.
- **Hardcoded credentials**: a secret scanner, or `eslint-plugin-no-secrets`.
