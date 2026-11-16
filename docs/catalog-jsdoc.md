# Catalog: the `jsdoc` config, doc comments that are well-formed

This catalog is the specification for the opt-in `jsdoc` config. It is separate from [`docs/catalog.md`](catalog.md) (*Clean Code, 2nd Edition*'s rules in `recommended`), [`docs/catalog-ai.md`](catalog-ai.md) (the habits of AI-generated code) and the language catalogs ([`docs/catalog-typescript.md`](catalog-typescript.md), [`docs/catalog-node.md`](catalog-node.md), [`docs/catalog-react.md`](catalog-react.md)). Its entries come from *Clean Code, 2nd Edition*, chapter 5 Comments, and every one of them is configuration of `eslint-plugin-jsdoc`: this config has no rule of its own.

JSDoc is written the same way in JavaScript and TypeScript, so `jsdoc` is a config of its own, like `node` and `react`, and not part of `typescript-extended`. It applies to the same files as `recommended` (`ALL_FILES` in `src/configs.ts`), except DOC-04, which applies to TypeScript files only (`TS_FILES`). It stacks on `recommended` the way `ai` does: `[...recommended, ...jsdoc]`. `recommended` is unchanged by it.

`jsdoc` is opt-in, and not in `recommended`, because `recommended` uses only ESLint core's rules and this plugin's own ([ADR 0004](adr/0004-language-configs-with-extended-companions.md)). Every rule here comes from `eslint-plugin-jsdoc`, an optional peer dependency that only `jsdoc` needs, loaded only when the config is read.

Each entry gives:

- **Source**: the book, its chapter and section, and the bookCTX chunk. Every citation refers to the book `clean-code-a-handbook-of-agile-software-craftsmanship-second-edition` in the bookCTX library: `chunk 9` means `get_chunk(book_slug="clean-code-a-handbook-of-agile-software-craftsmanship-second-edition", chunk=9)`.
- **Class**: `third-party`, a rule another plugin already has (`eslint-plugin-jsdoc`). The entry names the rule, and says whether Oxlint runs it natively.
- **Rule**, **Setting**, **Files** and **Why**: what the rule reports, and what the book says that makes it a defect.

Every rule is set to `error` with the plugin's default options, and listed one by one: the plugin's presets are not used, so no rule is turned on that no entry here grounds.

## What the book says

All four entries rest on one passage, chapter 5 Comments § Javadocs (and Their Ilk) in Public APIs (bookCTX chunk 9):

> "If you are writing a public API, then you should certainly write good document comments for it. But keep in mind the rest of the advice in this chapter. Document comments can be just as misleading, nonlocal, and dishonest as any other kind of comment."

A doc comment is read by tools as well as people: editors show it on hover, and documentation generators publish it. A doc comment that is malformed misleads both, and nothing else checks it. The rules below catch the ways a doc comment goes wrong that can be seen from the comment and the code beside it. Whether its prose is true is not lintable.

## The rule set at a glance

| Rule | Entry | Config | Class | Fix |
| --- | --- | --- | --- | --- |
| `jsdoc/check-param-names` | DOC-01 | jsdoc | third-party | none |
| `jsdoc/check-tag-names` | DOC-02 | jsdoc | third-party | none |
| `jsdoc/empty-tags` | DOC-03 | jsdoc | third-party | none |
| `jsdoc/no-types` | DOC-04 | jsdoc | third-party | none |

The Fix column is what this catalog asks for. `eslint-plugin-jsdoc` has fixes of its own for some of these rules, which `--fix` applies under ESLint; this catalog does not review them.

## Entries

#### DOC-01 · A `@param` names a parameter the function has

- **Source:** chapter 5 Comments § Javadocs (and Their Ilk) in Public APIs (bookCTX chunk 9).
- **Class:** third-party. `eslint-plugin-jsdoc` `jsdoc/check-param-names`. Oxlint 1.92's native `jsdoc` plugin has no `check-param-names`, so this entry is ESLint only.
- **Setting:** `"error"`. **Files:** `ALL_FILES`.
- **Why:** a `@param` for a parameter that was renamed or removed describes a function that no longer exists. It is the dishonest comment the book warns of: it still reads as documentation, and an editor still shows it, but it is wrong. The rule reports a `@param` whose name matches no parameter, and `@param` tags out of the parameters' order or repeated.

#### DOC-02 · Every tag is a tag the tools know

- **Source:** chapter 5 Comments § Javadocs (and Their Ilk) in Public APIs (bookCTX chunk 9).
- **Class:** third-party. `eslint-plugin-jsdoc` `jsdoc/check-tag-names`. Oxlint runs it natively, as `jsdoc/check-tag-names`.
- **Setting:** `"error"`. **Files:** `ALL_FILES`.
- **Why:** a misspelled tag, such as `@retrun`, is silently ignored by every tool that reads doc comments: the editor shows no return description, and the generated documentation leaves it out. The author believes the function is documented, and no reader sees it. The rule reports a tag that is not in the plugin's list of known tags.

#### DOC-03 · A tag that takes no content has none

- **Source:** chapter 5 Comments § Javadocs (and Their Ilk) in Public APIs (bookCTX chunk 9).
- **Class:** third-party. `eslint-plugin-jsdoc` `jsdoc/empty-tags`. Oxlint runs it natively, as `jsdoc/empty-tags`.
- **Setting:** `"error"`. **Files:** `ALL_FILES`.
- **Why:** a tag such as `@async`, `@abstract` or `@private` is a flag and takes no content. Text written after it (`@private until the next release`) is misread: tools drop it or take it as part of the tag, so the comment says something different to a tool than to the person who wrote it. The rule reports content on a tag that takes none.

#### DOC-04 · No `{type}` in a TypeScript doc comment

- **Source:** chapter 5 Comments § Javadocs (and Their Ilk) in Public APIs (bookCTX chunk 9).
- **Class:** third-party. `eslint-plugin-jsdoc` `jsdoc/no-types`. Oxlint 1.92's native `jsdoc` plugin has no `no-types`, so this entry is ESLint only.
- **Setting:** `"error"`. **Files:** `TS_FILES` only.
- **Why:** in TypeScript, a `{type}` in a `@param` or `@returns` tag repeats the type the signature already declares, and the compiler checks only the signature. When the signature changes, the comment's type does not, and it drifts into a misleading comment. The rule reports a `{type}` on a `@param`, `@returns` and similar tags.
- **Does not report:** a `{type}` in a JavaScript file, where the doc comment's type is the only type information the code has, and TypeScript's checker reads it in a JavaScript project.

## Oxlint mapping

The Oxlint export `jsdoc` uses Oxlint's native `jsdoc` plugin (`plugins: ["jsdoc"]`) and loads no JS plugin.

| ESLint rule | Oxlint | Note |
| --- | --- | --- |
| `jsdoc/check-param-names` | none | ESLint only: Oxlint 1.92 has no `jsdoc/check-param-names` |
| `jsdoc/check-tag-names` | `jsdoc/check-tag-names` | native |
| `jsdoc/empty-tags` | `jsdoc/empty-tags` | native |
| `jsdoc/no-types` | none | ESLint only: Oxlint 1.92 has no `jsdoc/no-types` |

## Optional peer dependency

`eslint-plugin-jsdoc`, `>=65.0.0`, `optional: true` in `package.json`'s `peerDependenciesMeta`, needed by ESLint's `jsdoc` config only.

## Related

AI-01 (`ai-no-inline-comments`, in [`docs/catalog-ai.md`](catalog-ai.md)) keeps `/** */` doc comments on declarations and reports the comments that narrate code. `jsdoc` is its companion: it checks that the doc comments that stay are well-formed.
