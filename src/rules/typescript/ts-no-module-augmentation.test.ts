import { runRuleTests } from "../../testing/run-rule-tests.ts";
import rule from "./ts-no-module-augmentation.ts";

runRuleTests("ts-no-module-augmentation", rule, {
  valid: [
    {
      name: "an ambient declaration for an untyped module, in a script-mode .d.ts file",
      filename: "file.d.ts",
      code: "declare module \"legacy\" {\n  export function run(): void;\n}",
    },
    { name: "declare global, which the book uses to extend a built-in safely", code: "export {};\ndeclare global {\n  interface Array<T> {\n    zip(list: T[]): T[];\n  }\n}" },
    { name: "a namespace with an identifier name", code: "export {};\ndeclare module Orders {\n  const total: number;\n}" },
    { name: "a namespace", code: "export namespace Orders {\n  export const total = 1;\n}" },
    { name: "a wrapper module, as the book recommends", code: "import express from \"express\";\nexport function app() {\n  return express();\n}" },
  ],
  invalid: [
    {
      name: "the ticket's case: declare module \"express\" in a module",
      code: "import type { User } from \"./user\";\ndeclare module \"express\" {\n  interface Request {\n    user: User;\n  }\n}",
      output: null,
      errors: [{ messageId: "augmentation", line: 2 }],
    },
    {
      name: "the book's case: import 'react', then declare module 'react'",
      code: "import 'react';\ndeclare module 'react' {\n  export function inspect<T>(element: T): void;\n}",
      output: null,
      errors: [{ messageId: "augmentation", line: 2 }],
    },
    { name: "in a file that only exports", code: "export {};\ndeclare module \"express\" {\n  interface Request {}\n}", output: null, errors: [{ messageId: "augmentation" }] },
    {
      name: "in a module-mode .d.ts file",
      filename: "file.d.ts",
      code: "import type { Config } from \"./config\";\ndeclare module \"vite\" {\n  interface UserConfig {\n    app: Config;\n  }\n}",
      output: null,
      errors: [{ messageId: "augmentation" }],
    },
  ],
});
