import { runRuleTests } from "../testing/run-rule-tests.ts";
import rule from "./return-boolean-directly.ts";

const inputs = "[0, 1, '', 'a', null, undefined, NaN, [], {}].map((v) => f(v))";

runRuleTests("return-boolean-directly", rule, {
  valid: [
    "function f(c) { return c > 1; }",
    "function f(c) { if (c) { return true; } return 1; }",
    "function f(c) { if (c) { log(); return true; } else { return false; } }",
    "function f(c) { if (c) return true; else return true; }",
    "function f(c) { if (c) return true; log(); return false; }",
  ],
  invalid: [
    {
      name: "a comparison is returned as it is",
      code: "function f(c) { if (c > 0) { return true; } else { return false; } }",
      output: "function f(c) { return c > 0; }",
      errors: [{ messageId: "branchToBoolean" }],
      behaviour: inputs,
    },
    {
      name: "a value that may not be boolean is coerced the same way the `if` tests it",
      code: "function f(c) { if (c) { return true; } else { return false; } }",
      output: "function f(c) { return !!(c); }",
      errors: 1,
      behaviour: inputs,
    },
    {
      name: "the inverse",
      code: "function f(c) { if (c) return false; else return true; }",
      output: "function f(c) { return !(c); }",
      errors: 1,
      behaviour: inputs,
    },
    {
      name: "the else left out",
      code: "function f(c) {\n  if (c === 1) {\n    return true;\n  }\n  return false;\n}",
      output: "function f(c) {\n  return c === 1;\n}",
      errors: 1,
      behaviour: inputs,
    },
    {
      name: "a sequence expression keeps its parentheses",
      code: "function f(c) { if ((0, c)) return true; return false; }",
      output: "function f(c) { return !!(0, c); }",
      errors: 1,
      behaviour: inputs,
    },
    {
      name: "a comment inside moves above the return, so a line comment cannot end the statement early",
      code: "function f(c) {\n  if (c) {\n    // the reason\n    return true;\n  }\n  return false;\n}",
      output: "function f(c) {\n  // the reason\n  return !!(c);\n}",
      errors: 1,
      behaviour: inputs,
    },
    {
      name: "a logical expression of comparisons is a boolean",
      code: "const f = (c) => { if (c > 0 && c < 9) { return true; } return false; };",
      output: "const f = (c) => { return c > 0 && c < 9; };",
      errors: 1,
      behaviour: inputs,
    },
    {
      name: "`??` is not a boolean operator",
      code: "function f(c) { if (c ?? 0) return true; return false; }",
      output: "function f(c) { return !!(c ?? 0); }",
      errors: 1,
      behaviour: inputs,
    },
  ],
});
