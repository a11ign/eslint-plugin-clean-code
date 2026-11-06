The opt-in `node` and `node-extended` configs from `docs/catalog-node.md`. ESLint gets `configs.node` and `configs["node-extended"]`, Oxlint the `node` and `nodeExtended` exports of `eslint-plugin-clean-code-book/oxlint`. `node` turns on four report-only `"error"` rules, registered as `clean-code-book/node-<name>`: `node-no-sync-in-handler` (NODE-01), `node-no-recursive-next-tick` (NODE-03), `node-exit-after-fatal-error` (NODE-04) and `node-no-error-message-matching` (NODE-06). The rules live in `src/rules/node/`, their pages in `docs/rules/node/`. `node-extended` turns on `n/handle-callback-err` with `^(err|error)$` (NODE-08) and nothing else, and its Oxlint export runs the native `node/handle-callback-err` with no JS plugin. `eslint-plugin-n` is an optional peer dependency, loaded only when ESLint's `node-extended` is read. `test/node-config.test.ts` runs the README's `node` and `node-extended` setup blocks, as written, under both linters on `test/fixtures/node/`, one file per acceptance scenario. `recommended`, `recommended-type-checked`, `ai` and the catalogs are unchanged.

Acceptance:
```bash
set -euo pipefail
pnpm install --frozen-lockfile
pnpm run build
pnpm run typecheck
pnpm run lint
# Every test: each node rule's cases under ESLint and Oxlint; the README's node and node-extended setup under both linters on
# the scenario fixtures; node loading without eslint-plugin-n; the node catalog, doc pages and the README's node tables.
pnpm exec rstest run
# The four node rules, each with its doc page; still 36 book rules and 5 ai rules.
test "$(ls src/rules/node/node-*.ts | grep -v '\.test\.ts$' | grep -v 'node-calls\.ts$' | wc -l)" -eq 4
test "$(ls docs/rules/node/*.md | wc -l)" -eq 4
test "$(ls src/rules/*.ts | grep -v -e '\.test\.ts$' -e '/index\.ts$' | wc -l)" -eq 36
test "$(ls src/rules/ai/*.ts | grep -v '\.test\.ts$' | wc -l)" -eq 5
# eslint-plugin-n is an optional peer dependency.
node -e 'const p = require("./package.json"); if (!p.peerDependencies["eslint-plugin-n"] || p.peerDependenciesMeta["eslint-plugin-n"].optional !== true) process.exit(1)'
# The configs as built: node-extended is exactly n/handle-callback-err with ^(err|error)$, and Oxlint's uses the native rule.
node --input-type=module -e '
import cleanCode from "eslint-plugin-clean-code-book";
import { nodeExtended } from "eslint-plugin-clean-code-book/oxlint";
const rules = Object.assign({}, ...cleanCode.configs["node-extended"].map((c) => c.rules));
if (JSON.stringify(rules) !== JSON.stringify({ "n/handle-callback-err": ["error", "^(err|error)$"] })) process.exit(1);
if (JSON.stringify(nodeExtended) !== JSON.stringify({ plugins: ["node"], rules: { "node/handle-callback-err": ["error", "^(err|error)$"] } })) process.exit(1);
'
# The catalogs, and the rules of recommended, recommended-type-checked and ai, are untouched.
git diff --quiet origin/main -- docs/catalog.md docs/catalog-ai.md docs/catalog-node.md
! git diff origin/main -- src/configs.ts | grep -E '^[-+]' | grep -v -e '^+++' -e '^---' | grep -E 'SYNTAX_RULES|TEST_FILE_RULES|TYPE_CHECKED|BUILT_IN_RULES|AI_RULES'
# The release is a minor bump.
grep -q '"eslint-plugin-clean-code-book": minor' .changeset/node-config.md
pnpm exec changeset status --verbose | grep -q "node-config.md"
# The package ships the node rule docs.
npm pack --dry-run --ignore-scripts --json | grep -q '"path": "docs/rules/node/node-no-sync-in-handler.md"'
