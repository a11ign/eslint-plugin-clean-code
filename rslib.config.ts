import { readFileSync } from "node:fs";
import { defineConfig } from "@rslib/core";
import { libraryPreset } from "@a11ign/toolchain/rslib-presets";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

// `tsconfig.build.json`, because the root `tsconfig.json` is the typecheck program and takes in the tests.
export default defineConfig({
  ...libraryPreset(pkg, { dir: import.meta.dirname }),
  source: { tsconfigPath: "./tsconfig.build.json" },
});
