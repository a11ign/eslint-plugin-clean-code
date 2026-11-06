import { runRuleTests } from "../testing/run-rule-tests.ts";
import rule from "./no-complex-condition.ts";

runRuleTests("no-complex-condition", rule, {
  valid: [
    { name: "three operands of one operator", code: "if (a && b && c) go();" },
    { name: "three `||` operands", code: "while (a || b || c) step();" },
    { name: "a named predicate", code: "if (isEligible(order)) go();" },
    { name: "`??` is one operand, not a third operator", code: "if ((a ?? b) && c) go();" },
    { name: "a logical expression outside a condition is not checked", code: "const ok = a && b || c;" },
    { name: "a call's arguments are one operand", code: "if (check(a && b || c)) go();" },
    { name: "a higher threshold", code: "if (a && b && c && d) go();", options: [{ maxOperands: 4 }] },
  ],
  invalid: [
    {
      name: "the book's example, `x(a) && y || !z(c, d)`",
      code: "if (x(a) && y || !z(c, d)) go();",
      errors: [{ messageId: "mixed", data: { kind: "if" } }],
      output: null,
    },
    {
      name: "four operands of `&&`",
      code: "if (a && b && c && d) go();",
      errors: [{ messageId: "tooManyOperands", data: { kind: "if", count: "4", operator: "&&", max: "3" } }],
      output: null,
    },
    {
      name: "a mix inside parentheses",
      code: "while ((a || b) && c) step();",
      errors: [{ messageId: "mixed", data: { kind: "while" } }],
      output: null,
    },
    {
      name: "a mix behind `!`",
      code: "do step(); while (!(a && b) || c);",
      errors: [{ messageId: "mixed", data: { kind: "do…while" } }],
      output: null,
    },
    {
      name: "a ternary test",
      code: "const v = a || b || c || d ? 1 : 2;",
      errors: [{ messageId: "tooManyOperands", data: { kind: "ternary", count: "4", operator: "||", max: "3" } }],
      output: null,
    },
    {
      name: "`else if` is checked too",
      code: "if (a) one(); else if (a && b || c) two();",
      errors: [{ messageId: "mixed", data: { kind: "if" }, column: 24 }],
      output: null,
    },
    {
      name: "a lower threshold",
      code: "if (a && b) go();",
      options: [{ maxOperands: 1 }],
      errors: [{ messageId: "tooManyOperands", data: { kind: "if", count: "2", operator: "&&", max: "1" } }],
      output: null,
    },
  ],
});
