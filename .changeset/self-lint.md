---
"eslint-plugin-clean-code-book": minor
---

The plugin now lints itself with its own `recommended-type-checked`, `typescript` and `ai` configs, and three rule bugs that run found are fixed. `no-noise-words` reports the word `variable` only at the end of a name after another word (`nameVariable`), not alone or inside a longer name (`variable`, `variableWord`, `VARIABLE_DEFS`), where it names the thing itself, as Use Solution Domain Names allows. `no-position-markers` leaves a run inside a Markdown code span of a doc comment alone, since it quotes code; its autofix had stripped such an example. `stepdown-order` checks a function's own name, not its last parameter, before moving it, so it no longer moves a function with parameters that a `var` of the same name also declares. The message ids of `ai-no-placeholder-values` and `ai-no-placeholder-implementation` are now `placeholderValue` and `stubImplementation`.

`ai-no-inline-comments` also reports a `/** */` doc comment that documents nothing: one on a statement, with nothing after it, or inside a function body, even on a local declaration. A doc comment still stays on a declaration outside any function body, and as the file's overview before the first statement. Before, any comment written as `/** */` passed, so a narrating comment could pass for documentation.
