The opt-in `typescript`, `typescript-extended` and `typescript-extended-type-checked` configs from `docs/catalog-typescript.md`, and `docs/adr/` with ADRs 0001 to 0004. ESLint gets `configs.typescript`, `configs["typescript-extended"]` and `configs["typescript-extended-type-checked"]`; Oxlint the `typescript` and `typescriptExtended` exports of `eslint-plugin-clean-code-book/oxlint`, and no type-checked export. `typescript` turns on three report-only `"error"` rules on every JavaScript and TypeScript file, registered as `clean-code-book/ts-<name>`: `ts-no-definite-assignment-assertion` (TS-04), `ts-no-amd-dependency` (TS-14) and `ts-no-module-augmentation` (TS-15), and `eqeqeq` `"always"` (TS-06). The rules live in `src/rules/typescript/`, their pages in `docs/rules/typescript/`. `typescript-extended` turns on typescript-eslint's `no-explicit-any`, `consistent-type-assertions` (`assertionStyle: "never"`), `no-non-null-assertion` and `triple-slash-reference` (`lib: "never"`) on TypeScript files and `promise/prefer-catch` on every file; its Oxlint export runs the same five natively through `plugins: ["typescript", "promise"]`, with no JS plugin. `typescript-extended-type-checked` adds `no-floating-promises` and `switch-exhaustiveness-check` with the project service on. `eslint-plugin-promise` is an optional peer dependency, loaded only when an extended config is read. `test/typescript-config.test.ts` runs the README's typescript setup blocks, as written, under both linters on `test/fixtures/typescript/`, one file per acceptance scenario. The four ADRs are copied byte for byte from the ticket's attachments; the `ai` citations moved from "ADR 0001" to "ADR 0003", and the language catalogs' "ADR 0001 of A11-415" to "ADR 0004". The rules of `recommended`, `recommended-type-checked`, `ai`, `node`, `node-extended`, `react` and `react-extended` are unchanged.

Acceptance:
```bash
set -euo pipefail
pnpm install --frozen-lockfile
pnpm run build
pnpm run typecheck
pnpm run lint
# Every test: each ts- rule's cases under ESLint and Oxlint; the README's typescript setup blocks under both linters on the
# scenario fixtures; typescript loading with no optional plugin installed; the typescript catalog, doc pages, README tables and ADRs.
pnpm exec rstest run
# The three ts- rules, each with its doc page; still 36 book rules, 5 ai, 4 node and 2 react rules.
test "$(ls src/rules/typescript/ts-*.ts | grep -v '\.test\.ts$' | wc -l)" -eq 3
test "$(ls docs/rules/typescript/*.md | wc -l)" -eq 3
test "$(ls src/rules/*.ts | grep -v -e '\.test\.ts$' -e '/index\.ts$' | wc -l)" -eq 36
test "$(ls src/rules/ai/*.ts | grep -v '\.test\.ts$' | wc -l)" -eq 5
test "$(ls src/rules/node/node-*.ts | grep -v -e '\.test\.ts$' -e 'node-calls\.ts$' | wc -l)" -eq 4
test "$(ls src/rules/react/react-*.ts | grep -v -e '\.test\.ts$' -e 'react-hooks\.ts$' | wc -l)" -eq 2
# eslint-plugin-promise is an optional peer dependency, and typescript-eslint still is.
node -e 'const p = require("./package.json"); for (const n of ["eslint-plugin-promise", "typescript-eslint"]) if (!p.peerDependencies[n] || p.peerDependenciesMeta[n].optional !== true) process.exit(1)'
# The configs as built.
node --input-type=module -e '
import cleanCode from "eslint-plugin-clean-code-book";
import oxlintConfigs, { typescript, typescriptExtended } from "eslint-plugin-clean-code-book/oxlint";
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const rulesOf = (config) => Object.assign({}, ...config.map((c) => c.rules ?? {}));
const ts = { eqeqeq: ["error", "always"], "clean-code-book/ts-no-amd-dependency": "error", "clean-code-book/ts-no-definite-assignment-assertion": "error", "clean-code-book/ts-no-module-augmentation": "error" };
if (!same(rulesOf(cleanCode.configs.typescript), ts) || !same(typescript.rules, ts)) process.exit(1);
if (!same(cleanCode.configs.typescript.flatMap((c) => Object.keys(c.plugins ?? {})), ["clean-code-book"])) process.exit(2);
const ext = {
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "never" }],
  "@typescript-eslint/no-non-null-assertion": "error",
  "@typescript-eslint/triple-slash-reference": ["error", { path: "never", types: "prefer-import", lib: "never" }],
  "promise/prefer-catch": "error",
};
if (!same(rulesOf(cleanCode.configs["typescript-extended"]), ext)) process.exit(3);
const checked = { ...ext, "@typescript-eslint/no-floating-promises": "error", "@typescript-eslint/switch-exhaustiveness-check": "error" };
if (!same(rulesOf(cleanCode.configs["typescript-extended-type-checked"]), checked)) process.exit(4);
if (!same(typescriptExtended.plugins, ["typescript", "promise"]) || "jsPlugins" in typescriptExtended) process.exit(5);
if (Object.keys(oxlintConfigs).some((name) => name.includes("type-checked"))) process.exit(6);
'
# The ADRs, byte for byte as attached to A11-417.
printf '%s\n' \
  "45907158a512f1dac08a0a3cd46872486854098513c3644c45f86b1224ac1f3c  docs/adr/0001-own-plugin-replaces-george2f.md" \
  "918d21daf20d7b0df14d1a2091d83b8a8e2bdbd83b5362bec3dfcc2ee95cd44f  docs/adr/0002-eslint-and-oxlint-shared-rule-api.md" \
  "27de409111800082d1849afac0d0fe3209d652d02a91d36ae55833c16c5a5b75  docs/adr/0003-ai-config-separate-from-book-rules.md" \
  "0075a6cf0dc9064dc60b203f739cf9d7e5566bd593786d74dc569bdd52e7ccad  docs/adr/0004-language-configs-with-extended-companions.md" \
  | sha256sum -c -
test "$(ls docs/adr | wc -l)" -eq 4
# No "ADR 0001" citation remains outside docs/adr/, no "of A11-415" numbering, and no "ADR 0002" line changed.
# (A negated command never stops a set -e script, so each check below exits by itself.)
if git grep -n -e "ADR 0001" -e "ADR [0-9]* of A11-" -- ':!docs/adr' ':!.acceptance' ':!.changeset' ':!test'; then exit 1; fi
if git diff origin/main -- . ':!.acceptance' | grep -E '^-' | grep -v '^---' | grep 'ADR 0002'; then exit 1; fi
# The book's catalog, and the rules of recommended, recommended-type-checked, ai, node and react, are untouched.
git diff --quiet origin/main -- docs/catalog.md
if git diff origin/main -- src/configs.ts | grep -E '^[-+]' | grep -v -e '^+++' -e '^---' \
  | grep -E 'const (SYNTAX_RULES|TEST_FILE_RULES|TYPE_CHECKED_RULES|TYPE_CHECKED_OPTIONS|BUILT_IN_RULES|JS_UNUSED_VARS|TS_UNUSED_VARS|AI_RULES|NODE_RULES|NODE_EXTENDED_RULES|REACT_RULES|REACT_HOOKS_RULES|REACT_JSX_RULES) ='; then exit 1; fi
if git diff origin/main -- src/configs.ts | grep -E '^-  "'; then exit 1; fi
# The release is a minor bump, and the package ships the typescript rule docs.
grep -q '"eslint-plugin-clean-code-book": minor' .changeset/typescript-config.md
pnpm exec changeset status --verbose | grep -q "typescript-config.md"
npm pack --dry-run --ignore-scripts --json | grep -q '"path": "docs/rules/typescript/ts-no-module-augmentation.md"'
