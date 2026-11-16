// This repository's own lint: the plugin's own `recommended-type-checked`, `typescript` and `ai`, read from the source, so a
// change to a rule is linted by that change. A report here is either a defect in the code or a defect in the rule; the rule
// is fixed when it is wrong, and no rule is turned off or weakened for this repository.
import type { Linter } from "eslint";
import globals from "globals";
import cleanCode from "./src/index.ts";

const config: Linter.Config[] = [
  { ignores: ["node_modules/**", "dist/**", "src/testing/typed-fixture/**", "test/fixtures/**", "test/work/**"] },
  ...cleanCode.configs["recommended-type-checked"],
  ...cleanCode.configs.typescript,
  ...cleanCode.configs.ai,
  { files: ["**/*.ts"], languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: { ...globals.node } } },
];

export default config;
