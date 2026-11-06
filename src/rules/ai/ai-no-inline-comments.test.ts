import { runRuleTests } from "../../testing/run-rule-tests.ts";
import rule from "./ai-no-inline-comments.ts";

const LOOP = "for (const user of users) {\n  notify(user);\n}";

runRuleTests("ai-no-inline-comments", rule, {
  valid: [
    { name: "a doc comment", code: "/** Returns the invoice total, rounded to cents. */\nexport function total(): number { return 1; }" },
    { name: "a multi-line doc comment", code: "/**\n * Sends the invoice.\n * @param id the invoice's number in the ledger\n */\nexport function send(id: number) { return id; }" },
    { name: "eslint and oxlint directives", code: "// eslint-disable-next-line no-console\nconsole.log(1);\n/* eslint-disable no-alert */\n// oxlint-disable-next-line no-debugger\nrun();" },
    { name: "TypeScript directives and a triple-slash reference", code: "/// <reference types=\"node\" />\n// @ts-expect-error the type is wrong upstream\nrun();" },
    { name: "prettier, coverage, bundler and global directives", code: "// prettier-ignore\nconst m = [1,0,0,1];\n/* istanbul ignore next */\nrun(m);\n/* c8 ignore next */\nrun();\nimport(/* webpackChunkName: \"x\" */ \"./x\");\nimport(/* @vite-ignore */ path);\nconst y = /* #__PURE__ */ make();\nconst z = /* @__PURE__ */ make();\n/* global window */\nrun(y, z);" },
    { name: "the hashbang", code: "#!/usr/bin/env node\nrun();", filename: "file.js" },
    { name: "a top-of-file licence header (CMT-02)", code: "/*\n * Copyright (c) 2024 Acme Corp. All rights reserved.\n * Licensed under the Apache License, Version 2.0.\n */\nexport const a = 1;" },
    { name: "an SPDX licence line comment at the top", code: "// SPDX-License-Identifier: Apache-2.0\nexport const a = 1;" },
    { name: "a licence header after a hashbang", code: "#!/usr/bin/env node\n// Copyright 2024 Acme Corp.\nrun();", filename: "file.js" },
    { name: "a comment the `allow` list matches", code: "// WHY: the vendor API returns cents as a string\nconst cents = Number(raw);", options: [{ allow: ["^ ?WHY:"] }] },
  ],
  invalid: [
    {
      name: "a comment that narrates a loop",
      code: `// Loop through the users\n${LOOP}`,
      output: null,
      errors: [{ messageId: "comment", line: 1, data: { text: "Loop through the users" } }],
    },
    { name: "a block comment", code: "/* add the tax */\nconst total = net * 1.2;", output: null, errors: [{ messageId: "comment", line: 1 }] },
    { name: "a trailing comment", code: "const total = net * 1.2; // add the tax", output: null, errors: 1 },
    { name: "a run of line comments reports each line", code: "// Step 1: read\n// Step 2: write\nrun();", output: null, errors: 2 },
    { name: "a `/***` banner is not a doc comment", code: "/*** Section ***/\nrun();", output: null, errors: 1 },
    { name: "a licence-like comment that is not at the top of the file", code: "export const a = 1;\n// Copyright 2024 Acme Corp.\nexport const b = 2;", output: null, errors: 1 },
    { name: "a top-of-file comment that is not a licence", code: "// Helpers for the invoice page\nexport const a = 1;", output: null, errors: 1 },
    { name: "a comment the `allow` list does not match", code: "// because the vendor is slow\nrun();", options: [{ allow: ["^ ?WHY:"] }], output: null, errors: 1 },
    { name: "a regular-expression explanation is reported too: strict on purpose", code: "// Matches an email such as ada@example.com.\nconst email = /^[^@\\s]+@[^@\\s]+$/;", output: null, errors: 1 },
    {
      name: "a long comment is quoted cut short",
      code: `// ${"word ".repeat(20).trim()}\nrun();`,
      output: null,
      errors: [{ messageId: "comment", data: { text: `${"word ".repeat(20).slice(0, 59)}…` } }],
    },
  ],
});
