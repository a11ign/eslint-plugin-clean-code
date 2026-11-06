Step 5 of 5 of the Clean Code lint plugin: the README and the release. `README.md` shows the setup for ESLint 10 flat config (`recommended` and `recommended-type-checked`) and for Oxlint, how to change a rule in each, and lists every rule under the config it is in, with its doc page and whether it fixes. The setup tests write the README's own config blocks into a project and run each linter on them, so the README cannot show a setup that does not work. `.github/workflows/release.yml` releases the package to npm from `main` through the organisation's per-merge Changesets workflow; the two changesets make it 0.1.0. The package ships its build, its rule docs, the README and the LICENSE.

Acceptance:
```bash
set -euo pipefail
pnpm install --frozen-lockfile
pnpm run build
pnpm run typecheck
pnpm run lint
# Every test: each rule under ESLint and Oxlint, the README's setup blocks run as written, the README's rule tables, the package contents.
pnpm exec rstest run
# The README's setup blocks are the ones the setup tests run.
test "$(grep -c '<!-- setup: ' README.md)" -eq 5
# The release is 0.1.0.
pnpm exec changeset status --verbose | grep -q 'eslint-plugin-clean-code-book -> 0.1.0'
# The release workflow publishes to npm through the shared workflow, pinned by full sha, gated on `gate`.
grep -Eq 'uses: a11ign/toolchain/\.github/workflows/release-per-merge\.yml@[0-9a-f]{40}$' .github/workflows/release.yml
grep -q 'kind: npm' .github/workflows/release.yml
grep -q 'gate-check: gate' .github/workflows/release.yml
# The package carries the README and no organisation branding in it.
npm pack --dry-run --ignore-scripts --json | grep -q '"path": "README.md"'
! grep -qi 'a11ign' README.md
# Still 36 rules, each with its doc page, and the pinned Oxlint.
test "$(ls src/rules/*.ts | grep -v -e '\.test\.ts$' -e '/index\.ts$' | wc -l)" -eq 36
test "$(ls docs/rules/*.md | wc -l)" -eq 36
test "$(./node_modules/.bin/oxlint --version | grep -o '[0-9.]*$')" = "1.92.0"
```
