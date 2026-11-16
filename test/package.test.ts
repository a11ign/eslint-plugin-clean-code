/**
 * The published package: nothing published carries the organisation's branding, the toolchain is a dev dependency only, the
 * plugins the extended configs load are optional peer dependencies, and the package ships its build, its rule docs, the README
 * and the LICENSE.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { PACKAGE_NAME } from "../src/lib/define-rule.ts";
import { docPath, readme, rules } from "./plugin-support.ts";
import { ROOT } from "./support.ts";

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

describe("the published package", () => {
  it("has an unscoped name, and the toolchain is a dev dependency only", () => {
    assert.equal(pkg.name, PACKAGE_NAME);
    assert.doesNotMatch(pkg.name, /^@/);
    assert.ok(pkg.devDependencies["@a11ign/toolchain"]);
    assert.equal(pkg.dependencies?.["@a11ign/toolchain"], undefined);
    assert.equal(pkg.peerDependencies?.["@a11ign/toolchain"], undefined);
  });

  it("lists eslint-plugin-n as an optional peer dependency, and tests with it as a dev dependency", () => {
    assertOptionalPeerDependency("eslint-plugin-n");
  });

  it("lists eslint-plugin-promise as an optional peer dependency, tests with it as a dev dependency, and keeps typescript-eslint optional", () => {
    assert.equal(pkg.peerDependencies["eslint-plugin-promise"], ">=7.2.0", "7.2.0 is the first version with prefer-catch");
    assert.deepEqual(pkg.peerDependenciesMeta["eslint-plugin-promise"], { optional: true });
    assert.ok(pkg.devDependencies["eslint-plugin-promise"], "eslint-plugin-promise is not a dev dependency");
    assert.equal(pkg.dependencies?.["eslint-plugin-promise"], undefined);
    assert.deepEqual(pkg.peerDependenciesMeta["typescript-eslint"], { optional: true });
  });

  it("lists eslint-plugin-react-hooks and eslint-plugin-react as optional peer dependencies, and tests with them as dev dependencies", () => {
    for (const name of ["eslint-plugin-react-hooks", "eslint-plugin-react"]) assertOptionalPeerDependency(name);
    assert.equal(pkg.peerDependencies["eslint-plugin-react-hooks"], ">=6.0.0", "version 6 or later, as the catalog asks");
  });

  it("its README, rule docs and rule URLs carry no organisation branding", () => {
    const docFiles = readdirSync(join(ROOT, "docs", "rules"), { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile());
    const docs = docFiles.map((entry) => readFileSync(join(entry.parentPath, entry.name), "utf8"));
    assert.ok(docFiles.some((entry) => entry.parentPath.endsWith("ai")), "the ai rule docs are read too");
    assert.ok(docFiles.some((entry) => entry.parentPath.endsWith("typescript")), "the typescript rule docs are read too");
    assert.ok(docFiles.some((entry) => entry.parentPath.endsWith("node")), "the node rule docs are read too");
    assert.ok(docFiles.some((entry) => entry.parentPath.endsWith("react")), "the react rule docs are read too");
    for (const text of [readme, ...docs, ...Object.values(rules).map((rule) => rule.meta.docs.url)]) assert.doesNotMatch(text, /a11ign/i);
  });

  it("ships the build, every rule's doc page, the README and the LICENSE, and no source or tests", () => {
    const packed = spawnSync("npm", ["pack", "--dry-run", "--ignore-scripts", "--json"], { cwd: ROOT, encoding: "utf8" });
    assert.equal(packed.status, 0, packed.stderr);
    const files = new Set((JSON.parse(packed.stdout) as Array<{ files: Array<{ path: string }> }>)[0].files.map((file) => file.path));
    const expected = ["README.md", "LICENSE", "package.json", "dist/index.mjs", "dist/plugin.mjs", "dist/oxlint.mjs", "dist/index.d.ts"];
    for (const path of [...expected, ...Object.keys(rules).map(docPath)]) assert.ok(files.has(path), `${path} is not in the package`);
    for (const path of files) assert.match(path, /^(dist\/|docs\/rules\/|README\.md$|LICENSE$|package\.json$)/);
  });
});

/** `name` is an optional peer dependency, and a dev dependency the tests run with, and not a dependency. */
function assertOptionalPeerDependency(name: string): void {
  assert.ok(pkg.peerDependencies[name], `${name} is not a peer dependency`);
  assert.deepEqual(pkg.peerDependenciesMeta[name], { optional: true });
  assert.ok(pkg.devDependencies[name], `${name} is not a dev dependency`);
  assert.equal(pkg.dependencies?.[name], undefined);
}
