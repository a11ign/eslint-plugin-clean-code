---
"eslint-plugin-clean-code-book": minor
---

An opt-in `ai` config: five rules for the habits AI-generated code brings, for ESLint (`configs.ai`) and Oxlint (the `ai` export of `eslint-plugin-clean-code-book/oxlint`). `ai-no-inline-comments` reports every `//` and `/* */` comment that is not a `/** */` doc comment, a tool directive or a licence header; `ai-no-ceremonial-catch` a `catch` that only logs and rethrows, or only logs (unless `allowSwallow`); `ai-no-placeholder-implementation` a body that is only `throw new Error("Not implemented")` or a stub return; `ai-no-emoji` emoji in comments and strings; `ai-no-placeholder-values` strings such as `"YOUR_API_KEY"`. Every `ai` rule is an error and report-only. The rules are justified in their own catalog, `docs/catalog-ai.md`. `recommended` and `recommended-type-checked` are unchanged.
