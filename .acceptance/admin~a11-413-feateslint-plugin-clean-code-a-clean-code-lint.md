Step 4 of 5 of the Clean Code lint plugin: every catalog entry classed lintable is built. `recommended` holds 31 custom rules that need only syntax, plus the built-in rules the catalog maps to the book, for ESLint 10 flat config and (as `eslint-plugin-clean-code-book/oxlint`) for Oxlint. `recommended-type-checked` adds 5 rules that need type information, for ESLint. Each rule has a doc page in `docs/rules/`, every message names the problem, the book passage and the refactor, and 13 rules fix what they report. Every rule's cases run under ESLint and under Oxlint 1.92.0; every fix is checked for its output, for no report on the output, and for the same results before and after on the same inputs. The whole-config tests run each linter's setup on JS, JSX, TS and TSX, and the regression cases of the catalog with every fix applied.

Acceptance:
```bash
set -euo pipefail
pnpm install --frozen-lockfile
pnpm run build
pnpm run typecheck
pnpm run lint
# Every rule's cases under ESLint and Oxlint, the typed rules, the config setup in both linters, and the regression cases.
pnpm exec rstest run
# The pinned Oxlint is the one the tests ran under.
test "$(node -p 'require("./package.json").devDependencies.oxlint')" = "1.92.0"
test "$(./node_modules/.bin/oxlint --version | grep -o '[0-9.]*$')" = "1.92.0"
# 36 rules, each with its doc page.
test "$(ls src/rules/*.ts | grep -v -e '\.test\.ts$' -e '/index\.ts$' | wc -l)" -eq 36
test "$(ls docs/rules/*.md | wc -l)" -eq 36
# No organisation branding in the published docs and rule URLs.
! grep -rniE 'a11ign' docs/rules src/lib/define-rule.ts
```
