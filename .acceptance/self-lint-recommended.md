The plugin lints itself with its own `recommended-type-checked`, `typescript` and `ai` configs, read from `src/`, and reports nothing. Every report was fixed in the code, except three that were the rules' own bugs (`no-noise-words` on `variable`, `no-position-markers` inside a doc comment's code span, `stepdown-order` reading a parameter as the function's name), which are fixed in the rules with tests. No rule is turned off or weakened, and there is no `eslint-disable` comment.

Acceptance:
```bash
set -euo pipefail
pnpm install --frozen-lockfile
pnpm run build
pnpm run typecheck
# The repository's lint is the plugin's own configs, and it reports nothing.
grep -q 'cleanCode.configs\["recommended-type-checked"\]' eslint.config.ts
grep -q 'cleanCode.configs.typescript' eslint.config.ts
grep -q 'cleanCode.configs.ai' eslint.config.ts
pnpm run lint
# Nothing is switched off to get there.
# A real directive starts a comment; test cases quote it inside strings, and test/fixtures/ is linted by the tests, not by this config.
! grep -rnE --exclude-dir=fixtures '^\s*(//|/\*)\s*eslint-disable' src test eslint.config.ts rslib.config.ts rstest.config.ts
# Every test, including the new cases for the three rule fixes.
pnpm exec rstest run
```
