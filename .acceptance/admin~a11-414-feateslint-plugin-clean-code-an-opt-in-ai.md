An opt-in `ai` config for the habits AI-generated code brings, beside the book's `recommended`. ESLint gets `configs.ai` and Oxlint the `ai` export of `eslint-plugin-clean-code-book/oxlint`; each turns on five report-only `"error"` rules, registered as `clean-code-book/ai-<name>`: `ai-no-inline-comments`, `ai-no-ceremonial-catch`, `ai-no-placeholder-implementation`, `ai-no-emoji` and `ai-no-placeholder-values`. The rules live in `src/rules/ai/`, their pages in `docs/rules/ai/`, and their catalog, with the AI pattern, the harm and a Language basis line for each, in `docs/catalog-ai.md`. `test/ai-config.test.ts` runs the README's `ai` setup blocks, as written, under both linters on `test/fixtures/ai/`, one file per acceptance scenario. `recommended`, `recommended-type-checked` and `docs/catalog.md` are unchanged.

Acceptance:
```bash
set -euo pipefail
pnpm install --frozen-lockfile
pnpm run build
pnpm run typecheck
pnpm run lint
# Every test: each ai rule's cases under ESLint and Oxlint, the README's ai setup under both linters on the scenario fixtures,
# recommended alone reporting no ai- rule, --fix leaving the comment, the ai catalog and doc pages, the README's "In `ai`" table.
pnpm exec rstest run
# The five ai rules, each with its doc page, and still 36 book rules with theirs.
test "$(ls src/rules/ai/*.ts | grep -v '\.test\.ts$' | wc -l)" -eq 5
test "$(ls docs/rules/ai/*.md | wc -l)" -eq 5
test "$(ls src/rules/*.ts | grep -v -e '\.test\.ts$' -e '/index\.ts$' | wc -l)" -eq 36
test "$(ls docs/rules/*.md | wc -l)" -eq 36
# Each ai rule has a catalog entry with a Language basis line, and the catch rule explains the book's delete() example.
test "$(grep -c '^- \*\*Language basis:\*\* ' docs/catalog-ai.md)" -eq 5
grep -q '^## Where this departs from the book$' docs/rules/ai/ai-no-ceremonial-catch.md
grep -q 'delete()' docs/rules/ai/ai-no-ceremonial-catch.md
# The book's catalog and recommended are untouched.
git diff --quiet origin/main -- docs/catalog.md
! git diff origin/main -- src/configs.ts | grep -E '^[-+]' | grep -v -e '^+++' -e '^---' | grep -E 'SYNTAX_RULES|TEST_FILE_RULES|TYPE_CHECKED|BUILT_IN_RULES'
# The release is a minor bump.
grep -q '"eslint-plugin-clean-code-book": minor' .changeset/ai-config.md
pnpm exec changeset status --verbose | grep -q "ai-config.md"
# The package ships the ai rule docs.
npm pack --dry-run --ignore-scripts --json | grep -q '"path": "docs/rules/ai/ai-no-ceremonial-catch.md"'
