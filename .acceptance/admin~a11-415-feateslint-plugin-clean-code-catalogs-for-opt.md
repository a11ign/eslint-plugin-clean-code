Three catalogs, the specifications for the opt-in `typescript`, `react` and `node` configs, written before any of their rules, as `docs/catalog.md` and `docs/catalog-ai.md` were: `docs/catalog-typescript.md` (TS-01 to TS-16), `docs/catalog-react.md` (RCT-01 to RCT-11) and `docs/catalog-node.md` (NODE-01 to NODE-10). Every entry quotes a passage from a book in the bookCTX library with its slug and chunk, and has one of seven classes: `syntax`, `types`, `built-in`, `third-party`, `covered`, `conflicts` or `not lintable`. Each catalog has "What the owner is asked to approve", "The rule set at a glance", "Entries", "Conflicts with `recommended` and `ai`", "Gaps" and "Extended configs" (its `<name>-extended` rules and settings, optional peer dependencies and Oxlint mapping). No rule, config, source file or dependency changes.

Acceptance:
```bash
set -euo pipefail
pnpm install --frozen-lockfile
# The structure of each catalog: its sections, and for every entry a Source with a book slug and a chunk, a Quote, and one class.
node --input-type=module - <<'JS'
import { readFileSync } from "node:fs";
const CLASSES = ["syntax", "types", "built-in", "third-party", "covered", "conflicts", "not lintable"];
const SECTIONS = ["## What the owner is asked to approve", "## The rule set at a glance", "## Entries", "## Conflicts with `recommended` and `ai`", "## Gaps", "## Extended configs"];
const SOURCE = /`(programming-typescript|clean-code-with-typescript-…|javascript-the-definitive-guide|learn-react-with-typescript-third-edition|react-design-patterns-…|react-application-architecture-…|test-driven-react-second-edition|distributed-systems-with-node-js)` chunk \d+/;
const APPROVAL_ITEMS = ["entries", "conflict resolutions", "final name", "optional peer dependenc", "quotations in a public repository"];
const CATALOGS = [
  { name: "typescript", prefix: "TS", entryCount: 16, missingBook: "*Effective TypeScript*" },
  { name: "react", prefix: "RCT", entryCount: 11 },
  { name: "node", prefix: "NODE", entryCount: 10, missingBook: "*Node.js Design Patterns*" },
];
const failures = [];

const between = (text, from, to) => text.slice(text.indexOf(from), to ? text.indexOf(to) : undefined);

function checkSections(file, text) {
  for (const section of SECTIONS) if (!text.includes(`\n${section}\n`)) failures.push(`${file}: no section ${section}`);
}

function checkEntry(file, entry) {
  const id = entry.slice(5, entry.indexOf(" ·"));
  if (!SOURCE.test(entry.match(/^- \*\*Source:\*\* .*$/m)?.[0] ?? "")) failures.push(`${file} ${id}: no Source with a slug and chunk`);
  if (!/^- \*\*Quote[^*]*:\*\* \S/m.test(entry)) failures.push(`${file} ${id}: no Quote`);
  const cls = entry.match(/^- \*\*Class:\*\* ([a-z -]+?)[.,]/m)?.[1];
  if (!CLASSES.includes(cls)) failures.push(`${file} ${id}: class "${cls}" is not one of the seven`);
  if (cls === "third-party" && !entry.includes("Oxlint")) failures.push(`${file} ${id}: third-party entry does not say whether Oxlint runs it`);
  if (cls === "covered" && !/[A-Z]{2,4}-\d\d/.test(entry.split("**Class:**")[1])) failures.push(`${file} ${id}: covered entry names no entry`);
}

function checkEntries(file, text, { prefix, entryCount }) {
  const entries = text.split(/\n(?=#### )/).filter((part) => part.startsWith(`#### ${prefix}-`));
  if (entries.length !== entryCount) failures.push(`${file}: ${entries.length} entries, expected ${entryCount}`);
  for (const entry of entries) checkEntry(file, entry);
}

function checkApprovalList(file, text) {
  const approval = between(text, "## What the owner is asked to approve", "## The rule set at a glance");
  for (const item of APPROVAL_ITEMS) if (!approval.toLowerCase().includes(item)) failures.push(`${file}: approval list does not cover "${item}"`);
  if (!approval.includes("`-extended` is a working name")) failures.push(`${file}: the -extended suffix is not an approval item`);
}

function checkExtendedConfigs(file, text, { name }) {
  const extended = between(text, "## Extended configs");
  for (const part of [`### \`${name}-extended\``, "### Optional peer dependencies", "### Oxlint mapping"]) {
    if (!extended.includes(part)) failures.push(`${file}: Extended configs has no ${part}`);
  }
}

function checkGaps(file, text, { missingBook }) {
  if (missingBook && !between(text, "## Gaps", "## Extended configs").includes(missingBook)) failures.push(`${file}: Gaps does not name ${missingBook}`);
}

for (const catalog of CATALOGS) {
  const file = `docs/catalog-${catalog.name}.md`;
  const text = readFileSync(file, "utf8");
  checkSections(file, text);
  checkEntries(file, text, catalog);
  checkApprovalList(file, text);
  checkExtendedConfigs(file, text, catalog);
  checkGaps(file, text, catalog);
}
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log("catalogs: structure holds for 37 entries");
JS
# Nothing but the three catalogs and this file changed: no source, no config, no dependency, no existing catalog.
git diff --quiet origin/main -- src package.json pnpm-lock.yaml docs/catalog.md docs/catalog-ai.md docs/rules README.md CONTRIBUTING.md
test -z "$(git diff --name-only origin/main | grep -v -e '^docs/catalog-typescript\.md$' -e '^docs/catalog-react\.md$' -e '^docs/catalog-node\.md$' -e '^\.acceptance/')"
# The suite, which checks catalog.md and catalog-ai.md against the plugin, is unaffected.
pnpm exec rstest run
```
