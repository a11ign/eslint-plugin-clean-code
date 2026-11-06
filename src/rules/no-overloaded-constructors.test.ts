import { runRuleTests } from "../testing/run-rule-tests.ts";
import rule from "./no-overloaded-constructors.ts";

runRuleTests("no-overloaded-constructors", rule, {
  valid: [
    "class A { constructor(a: number) {} }",
    "class A { constructor(a: number); constructor(a: number) {} }",
    "class A { static fromString(s: string) { return new A(Number(s)); } constructor(a: number) {} }",
  ],
  invalid: [
    {
      code: "class Point { constructor(x: number); constructor(s: string); constructor(v: unknown) {} }",
      errors: [{ messageId: "overloaded", line: 1 }],
      output: null,
    },
  ],
});
