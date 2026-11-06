import { runRuleTests } from "../../testing/run-rule-tests.ts";
import rule from "./ts-no-definite-assignment-assertion.ts";

runRuleTests("ts-no-definite-assignment-assertion", rule, {
  valid: [
    { name: "a variable assigned where it is declared", code: "let userId: string = load();" },
    { name: "a variable without !", code: "let userId: string;\nuserId = load();" },
    { name: "a field assigned in its declaration", code: "class Account {\n  name: string = \"\";\n}" },
    { name: "an optional field", code: "class Account {\n  name?: string;\n}" },
    { name: "a non-null expression, which is TS-03", code: "const element = document.getElementById(\"x\")!;" },
    { name: "a non-null expression in an assignment", code: "let element: Element;\nelement = document.getElementById(\"x\")!;" },
    { name: "plain JavaScript", filename: "file.js", code: "let userId;\nclass Account {\n  name;\n}" },
  ],
  invalid: [
    {
      name: "the ticket's case: a class field declared as name!: string",
      code: "class Account {\n  name!: string;\n}",
      output: null,
      errors: [{ messageId: "field", line: 2 }],
    },
    { name: "a let with a definite assignment assertion", code: "let userId!: string;\ninit();", output: null, errors: [{ messageId: "variable", line: 1 }] },
    { name: "one declarator of two", code: "let a: number, b!: number;", output: null, errors: [{ messageId: "variable" }] },
    { name: "a private field", code: "class K {\n  private p!: number;\n}", output: null, errors: [{ messageId: "field" }] },
    { name: "in a .tsx file", filename: "file.tsx", code: "class View {\n  ref!: HTMLElement;\n}", output: null, errors: [{ messageId: "field" }] },
  ],
});
