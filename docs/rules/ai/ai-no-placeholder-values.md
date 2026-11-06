# clean-code-book/ai-no-placeholder-values

Don't leave placeholder strings such as `"YOUR_API_KEY"` or `"<insert token>"` in the code.

- **Config:** `ai`
- **Fix:** no
- **Catalog entry:** AI-05 in [`docs/catalog-ai.md`](../../catalog-ai.md)

## The AI pattern

Generated code leaves values for a person to fill in: `"YOUR_API_KEY"`, `"<insert token>"`, `"your-api-key-here"`, `"changeme"`. A placeholder looks like a value, so the code runs, and fails later at the request that sends it, far from the line that is wrong.

**Language basis:** universal. A value a person was meant to fill in is missing in any language, and the failure comes at the same place: where it is first used.

## What it reports

A string literal, or a template literal with no `${…}` parts, whose whole text matches any of these, ignoring case:

- `^your[-_ ].+[-_ ]here$`
- `^YOUR_[A-Z_]+$`
- `^<(insert|your|enter) .+>$`
- `^(replace[-_ ]?me|changeme|xxx+|placeholder)$`
- `^sk-(xxx+|\.\.\.)$`

It does not report:

- strings that name something rather than give a value: a property key, a computed member name (`input["placeholder"]`), a module specifier, a TypeScript literal type;
- a string that only contains one of these words (`"placeholder text"`);
- test files (`*.test.*`, `*.spec.*` and files under `__tests__/`), where the `ai` config turns the rule off.

It is not a secret scanner, and does not look for real credentials.

## Examples

Incorrect:

```ts
const apiKey = "YOUR_API_KEY";
const token = "<insert token>";
```

Correct:

```ts
const apiKey = requiredEnv("API_KEY");
```

## Options

- `patterns` (`string[]`, default `[]`): more regular expressions, matched ignoring case, added to the ones above.

## Why there is no autofix

The real value is not in the code, and reading it from configuration changes how the program starts.
