---
"eslint-plugin-clean-code-book": minor
---

`recommended` no longer reports a parameter prefixed with `_` that the body never reads, such as an Express handler's `_req` (TS-09 in `docs/catalog-typescript.md`, which *Programming TypeScript* advises). ESLint's `no-unused-vars`, `@typescript-eslint/no-unused-vars` and Oxlint's `no-unused-vars` set `argsIgnorePattern: "^_"` and `reportUsedIgnorePattern: true`, so a `_` parameter that is read is reported. Only parameters are exempt: an unused `_x` variable, destructured `_y` or caught `_e` is still reported. The import fix guards stay. `recommended-type-checked` and the `typescript` config inherit the change; HRM-01 in `docs/catalog.md` cites TS-09.
