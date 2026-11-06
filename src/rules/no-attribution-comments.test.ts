import { runRuleTests } from "../testing/run-rule-tests.ts";
import rule from "./no-attribution-comments.ts";

runRuleTests("no-attribution-comments", rule, {
  valid: [
    { name: "review: \"Created by\" a class name is not a byline", code: "/** Created by ConnectionPool. */\nexport class Connection {}" },
    { name: "review: \"Modified by\" a tool is not a byline", code: "// Modified by Terser\nexport const minified = 1;" },
    { name: "a legal header (CMT-02)", code: "/*\n * Copyright (c) 2024 Acme Corp. All rights reserved.\n * Licensed under the Apache License, Version 2.0.\n */\nexport const a = 1;" },
    { name: "a regular-expression explanation (CMT-02)", code: "// Matches an email such as ada@example.com: a local part, `@`, then a domain.\nconst email = /^[^@\\s]+@[^@\\s]+$/;" },
    { name: "a \"why\" comment (CMT-02)", code: "// We retry once because the first request after a deploy is dropped by the proxy.\nretry(send);" },
    { name: "\"Created by\" followed by code, not a person", code: "// Created by Object.create(null), so it has no prototype\nconst bag = Object.create(null);" },
    { name: "\"Added by\" followed by lower-case words", code: "// Added by the build step, never by hand.\nconst version = '1';" },
    { name: "\"Created by\" a person but with more text after", code: "// Created by Ada Lovelace's algorithm, which this follows step by step.\nrun();" },
    { name: "issue keys and pull request numbers are not reported", code: "// See ABC-123 and #456.\nrun();" },
    { name: "a mention that is not a byline", code: "/** Thanks to @ada for the idea of caching here. */\nexport function f() {}" },
    { name: "a directive comment is never changed", code: "/*! @license MIT\n * @author Ada Lovelace */\nrun();" },
    { name: "directive comments are left alone", code: "// eslint-disable-next-line no-console\nconsole.log(1);\n/* @ts-ignore */\nrun();" },
  ],
  invalid: [
    {
      name: "a byline alone goes with its line",
      code: "// Created by John Smith\nexport const a = 1;",
      output: "export const a = 1;",
      errors: [{ messageId: "byline", line: 1 }],
      behaviour: "a",
    },
    {
      name: "an @author doc comment",
      code: "/**\n * @author Ada Lovelace <ada@example.com>\n */\nexport function f() { return 1; }",
      output: "export function f() { return 1; }",
      errors: 1,
      behaviour: "f()",
    },
    {
      name: "bylines with an email, a handle and a date",
      code: "/*\n * Added by ada@example.com\n * Modified by @babbage on 2024-01-31.\n * Created by J. R. Smith, 31-Jan-2024\n */\nexport const b = 2;",
      output: "export const b = 2;",
      errors: 1,
      behaviour: "b",
    },
    {
      name: "a byline in a comment with other text is reported without a fix",
      code: "/**\n * Parses the configuration file.\n * @author Ada Lovelace\n */\nexport function parse() {}",
      output: null,
      errors: 1,
    },
    {
      name: "a byline at the end of a sentence is reported without a fix",
      code: "// This cache was created by John Smith\nexport const cache = new Map();",
      output: null,
      errors: 1,
    },
    {
      name: "regression: a `;[1, 2]` line after a byline, in code without semicolons, keeps its `;`",
      code: "let r = 0\n// Modified by Ada Lovelace\n;[1, 2].forEach((v) => { r += v })",
      output: "let r = 0\n;[1, 2].forEach((v) => { r += v })",
      errors: 1,
      behaviour: "r",
    },
    {
      name: "a byline between `return` and its value, across lines, becomes a line break",
      code: "function f() {\n  return /* @author Ada Lovelace\n  */ 42\n}",
      output: "function f() {\n  return \n 42\n}",
      errors: 1,
      behaviour: ["f()", "typeof f()"],
    },
    {
      name: "a trailing byline goes with the space before it",
      code: "export const c = 3; // Added by Ada Lovelace",
      output: "export const c = 3;",
      errors: 1,
      behaviour: "c",
    },
    {
      name: "`return/*@author Ada*/value` keeps a space",
      code: "function f(value) { return/* @author Ada */value }",
      output: "function f(value) { return value }",
      errors: 1,
      behaviour: "[1, 'a'].map((v) => f(v))",
    },
  ],
});
