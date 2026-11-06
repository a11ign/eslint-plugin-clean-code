import { runRuleTests } from "../testing/run-rule-tests.ts";
import rule from "./error-handling-is-one-thing.ts";

runRuleTests("error-handling-is-one-thing", rule, {
  valid: [
    {
      name: "the book's `delete`: the `try` is the whole function",
      code: "function remove(page) {\n  try {\n    deletePageAndAllReferences(page);\n  } catch (e) {\n    logError(e);\n  }\n}",
    },
    { name: "variable declarations before the `try`", code: "function f() { const a = 1; let b; try { work(a, b); } catch (e) { log(e); } }" },
    { name: "a `finally` block ends the function", code: "const f = () => { try { work(); } finally { close(); } };" },
    { name: "a directive before the `try` is not a statement", code: "function f() { 'use strict'; try { work(); } catch (e) { log(e); } }", sourceType: "script" },
    { name: "TypeScript type declarations do nothing at run time", code: "function f() { type R = number; try { work(); } catch (e) { log(e); } }" },
    { name: "a function without `try`", code: "function f() { a(); b(); }" },
    { name: "a `try` that is not at the top level of the body is not this rule's", code: "function f() { if (x) { try { work(); } catch (e) { log(e); } } after(); }" },
    { name: "a `try` in a function inside a `catch` is that function's own", code: "function f() { try { work(); } catch (e) { retry(() => { try { again(); } catch (f) { log(f); } }); } }" },
    { name: "a `try` at the top of a module is not in a function", code: "setup();\ntry { work(); } catch (e) { log(e); }\ndone();" },
    { name: "a method whose body is the `try`", code: "class A { m() { try { this.work(); } catch (e) { this.log(e); } } }" },
  ],
  invalid: [
    {
      name: "work before the `try`",
      code: "function f() {\n  prepare();\n  try {\n    work();\n  } catch (e) {\n    log(e);\n  }\n}",
      errors: [{ messageId: "beforeTry", line: 2 }],
      output: null,
    },
    {
      name: "a statement after the `catch`",
      code: "function f() {\n  let result;\n  try {\n    result = work();\n  } catch (e) {\n    return null;\n  }\n  return result;\n}",
      errors: [{ messageId: "afterTry", line: 8 }],
      output: null,
    },
    {
      name: "a statement after the `finally`, in an arrow function",
      code: "const f = async () => { try { await work(); } finally { close(); } done(); };",
      errors: [{ messageId: "afterTry" }],
      output: null,
    },
    {
      name: "two `try` statements: the second comes after the first",
      code: "function f() { try { a(); } catch (e) { log(e); } try { b(); } catch (e) { log(e); } }",
      errors: [{ messageId: "afterTry", column: 51 }],
      output: null,
    },
    {
      name: "statements on both sides, in a method",
      code: "class A { m() { this.start(); try { this.work(); } catch (e) { this.log(e); } this.stop(); } }",
      errors: [{ messageId: "beforeTry" }, { messageId: "afterTry" }],
      output: null,
    },
    {
      name: "a function declaration before the `try` is not a variable declaration",
      code: "function f() { function helper() {} try { helper(); } catch (e) { log(e); } }",
      errors: [{ messageId: "beforeTry" }],
      output: null,
    },
    {
      name: "a `try` nested in a `catch` (the book's Noise Comments example)",
      code: "function f() {\n  try {\n    load();\n  } catch (e) {\n    try {\n      fallback();\n    } catch (f) {\n      log(f);\n    }\n  }\n}",
      errors: [{ messageId: "tryInCatch", line: 5 }],
      output: null,
    },
    {
      name: "a `try` nested deeper inside a `catch`",
      code: "try { load(); } catch (e) { if (retry) { try { fallback(); } catch (f) { log(f); } } }",
      errors: [{ messageId: "tryInCatch" }],
      output: null,
    },
  ],
});
