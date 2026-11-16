`recommended` sets `argsIgnorePattern: "^_"` and `reportUsedIgnorePattern: true` on ESLint's `no-unused-vars`, `@typescript-eslint/no-unused-vars` and Oxlint's `no-unused-vars` (TS-09). An unused `_req` parameter is not reported; an unused `req`, a `_x` variable, a destructured `_y`, a caught `_e` and a read `_x` parameter are. The import fix guards stay. HRM-01 cites TS-09, TS-09 is shown as built, and the changeset is minor.

Acceptance:
```bash
set -euo pipefail
pnpm install --frozen-lockfile
pnpm run build
pnpm run typecheck
pnpm run lint
# test/unused-parameters.test.ts runs the README's setups under ESLint and Oxlint on one file per scenario, and checks the guards.
pnpm exec rstest run
grep -q '"eslint-plugin-clean-code-book": minor' .changeset/underscore-parameters.md
grep -q 'TS-09' docs/catalog.md
grep -q 'recommended (built)' docs/catalog-typescript.md
```
