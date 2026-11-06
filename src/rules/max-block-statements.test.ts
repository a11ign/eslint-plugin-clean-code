import { runRuleTests } from "../testing/run-rule-tests.ts";
import rule from "./max-block-statements.ts";

runRuleTests("max-block-statements", rule, {
  valid: [
    { name: "a block holding a call to another function (the book's example)", code: "if (ready) { start(); }" },
    { name: "two statements", code: "if (ready) { prepare(); start(); } else { wait(); log(); }" },
    { name: "a body without braces", code: "while (busy) step();" },
    { name: "an empty block", code: "for (const x of xs) {}" },
    { name: "a nested block counts as one, and its own body is checked separately", code: "if (a) { if (b) { one(); two(); } done(); }" },
    { name: "`else if` is checked as its own `if`", code: "if (a) { one(); } else if (b) { one(); two(); }" },
    { name: "try and catch bodies of one or two statements (FH-06)", code: "try { work(); } catch (e) { log(e); report(e); } finally { close(); }" },
    { name: "a function body is not a block of this rule", code: "function f() { a(); b(); c(); }" },
    { name: "a switch case is not a block of this rule", code: "switch (x) { case 1: a(); b(); c(); }" },
    { name: "a higher threshold", code: "if (a) { one(); two(); three(); }", options: [{ max: 3 }] },
  ],
  invalid: [
    {
      name: "an `if` block of three statements",
      code: "if (ready) {\n  prepare();\n  start();\n  log();\n}",
      errors: [{ messageId: "tooManyStatements", data: { kind: "if", count: "3", max: "2" }, line: 1 }],
      output: null,
    },
    {
      name: "the `else` block",
      code: "if (a) { one(); } else { one(); two(); three(); }",
      errors: [{ messageId: "tooManyStatements", data: { kind: "else", count: "3", max: "2" } }],
      output: null,
    },
    {
      name: "every loop",
      code: [
        "for (let i = 0; i < n; i++) { a(); b(); c(); }",
        "for (const k in o) { a(); b(); c(); }",
        "for (const x of xs) { a(); b(); c(); }",
        "while (busy) { a(); b(); c(); }",
        "do { a(); b(); c(); } while (busy);",
      ].join("\n"),
      errors: [
        { messageId: "tooManyStatements", data: { kind: "for", count: "3", max: "2" }, line: 1 },
        { messageId: "tooManyStatements", data: { kind: "for…in", count: "3", max: "2" }, line: 2 },
        { messageId: "tooManyStatements", data: { kind: "for…of", count: "3", max: "2" }, line: 3 },
        { messageId: "tooManyStatements", data: { kind: "while", count: "3", max: "2" }, line: 4 },
        { messageId: "tooManyStatements", data: { kind: "do", count: "3", max: "2" }, line: 5 },
      ],
      output: null,
    },
    {
      name: "try, catch and finally blocks (FH-06)",
      code: "try { a(); b(); c(); } catch (e) { a(); b(); c(); } finally { a(); b(); c(); }",
      errors: [
        { messageId: "tooManyStatements", data: { kind: "try", count: "3", max: "2" } },
        { messageId: "tooManyStatements", data: { kind: "catch", count: "3", max: "2" } },
        { messageId: "tooManyStatements", data: { kind: "finally", count: "3", max: "2" } },
      ],
      output: null,
    },
    {
      name: "a nested block is checked on its own",
      code: "if (a) { if (b) { one(); two(); three(); } }",
      errors: [{ messageId: "tooManyStatements", data: { kind: "if", count: "3", max: "2" }, column: 17 }],
      output: null,
    },
    {
      name: "a lower threshold",
      code: "if (a) { one(); two(); }",
      options: [{ max: 1 }],
      errors: [{ messageId: "tooManyStatements", data: { kind: "if", count: "2", max: "1" } }],
      output: null,
    },
  ],
});
