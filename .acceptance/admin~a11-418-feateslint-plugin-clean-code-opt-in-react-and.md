The opt-in `react` and `react-extended` configs from `docs/catalog-react.md`. ESLint gets `configs.react` and `configs["react-extended"]`, Oxlint the `react` and `reactExtended` exports of `eslint-plugin-clean-code-book/oxlint`. `react` turns on two report-only `"error"` rules on `**/*.{jsx,tsx}`, registered as `clean-code-book/react-<name>`: `react-no-state-mutation` (RCT-06) and `react-no-untyped-empty-state` (RCT-07, `.tsx` only). The rules live in `src/rules/react/`, their pages in `docs/rules/react/`. `react` overrides no rule of `recommended`, so `max-lines-per-function` keeps 12 lines on components. `react-extended` turns on `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps` on `**/*.{jsx,tsx}` and `**/use*.{js,ts}`, and `react/jsx-key` and `react/no-array-index-key` on `**/*.{jsx,tsx}`, each `"error"`; its Oxlint export runs the same four natively through `plugins: ["react"]`, with no JS plugin. `eslint-plugin-react-hooks` and `eslint-plugin-react` are optional peer dependencies, loaded only when ESLint's `react-extended` is read. `test/react-config.test.ts` runs the README's `react` and `react-extended` setup blocks, as written, under both linters on `test/fixtures/react/`, one file per acceptance scenario. The catalogs and the rules of `recommended`, `recommended-type-checked`, `ai`, `node` and `node-extended` are unchanged.

Acceptance:
```bash
set -euo pipefail
pnpm install --frozen-lockfile
pnpm run build
pnpm run typecheck
pnpm run lint
# Every test: each react rule's cases under ESLint and Oxlint; the README's react and react-extended setup under both linters on
# the scenario fixtures; react loading without the React plugins; the react catalog, doc pages and the README's react tables.
pnpm exec rstest run
# The two react rules, each with its doc page; still 36 book rules, 5 ai rules and 4 node rules.
test "$(ls src/rules/react/react-*.ts | grep -v -e '\.test\.ts$' -e 'react-hooks\.ts$' | wc -l)" -eq 2
test "$(ls docs/rules/react/*.md | wc -l)" -eq 2
test "$(ls src/rules/*.ts | grep -v -e '\.test\.ts$' -e '/index\.ts$' | wc -l)" -eq 36
test "$(ls src/rules/ai/*.ts | grep -v '\.test\.ts$' | wc -l)" -eq 5
test "$(ls src/rules/node/node-*.ts | grep -v -e '\.test\.ts$' -e 'node-calls\.ts$' | wc -l)" -eq 4
# Both React plugins are optional peer dependencies.
node -e 'const p = require("./package.json"); for (const n of ["eslint-plugin-react", "eslint-plugin-react-hooks"]) if (!p.peerDependencies[n] || p.peerDependenciesMeta[n].optional !== true) process.exit(1)'
# The configs as built: react is the two react- rules on .jsx/.tsx; react-extended the four rules, each "error", on the catalog's
# files; Oxlint's reactExtended the same four under the native react plugin, with no jsPlugins.
node --input-type=module -e '
import cleanCode from "eslint-plugin-clean-code-book";
import { react, reactExtended } from "eslint-plugin-clean-code-book/oxlint";
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const eslintReact = cleanCode.configs.react.filter((c) => c.rules).map((c) => [c.files, c.rules]);
if (!same(eslintReact, [[["**/*.{jsx,tsx}"], { "clean-code-book/react-no-state-mutation": "error", "clean-code-book/react-no-untyped-empty-state": "error" }]])) process.exit(1);
const extended = cleanCode.configs["react-extended"].filter((c) => c.rules).map((c) => [c.files, c.rules]);
if (!same(extended, [
  [["**/*.{jsx,tsx}", "**/use*.{js,ts}"], { "react-hooks/rules-of-hooks": "error", "react-hooks/exhaustive-deps": "error" }],
  [["**/*.{jsx,tsx}"], { "react/jsx-key": "error", "react/no-array-index-key": "error" }],
])) process.exit(2);
if (!same(reactExtended.overrides.map((o) => [o.files, o.plugins, o.rules]), [
  [["**/*.{jsx,tsx}", "**/use*.{js,ts}"], ["react"], { "react/rules-of-hooks": "error", "react/exhaustive-deps": "error" }],
  [["**/*.{jsx,tsx}"], ["react"], { "react/jsx-key": "error", "react/no-array-index-key": "error" }],
]) || "jsPlugins" in reactExtended) process.exit(3);
if (!same(react.overrides, [{ files: ["**/*.{jsx,tsx}"], rules: eslintReact[0][1] }])) process.exit(4);
'
# The catalogs, and the rules of recommended, recommended-type-checked, ai and node, are untouched.
git diff --quiet origin/main -- docs/catalog.md docs/catalog-ai.md docs/catalog-node.md docs/catalog-react.md
! git diff origin/main -- src/configs.ts | grep -E '^[-+]' | grep -v -e '^+++' -e '^---' | grep -E 'SYNTAX_RULES|TEST_FILE_RULES|TYPE_CHECKED|BUILT_IN_RULES|AI_RULES|NODE_RULES|NODE_EXTENDED_RULES'
# The release is a minor bump.
grep -q '"eslint-plugin-clean-code-book": minor' .changeset/react-config.md
pnpm exec changeset status --verbose | grep -q "react-config.md"
# The package ships the react rule docs.
npm pack --dry-run --ignore-scripts --json | grep -q '"path": "docs/rules/react/react-no-state-mutation.md"'
