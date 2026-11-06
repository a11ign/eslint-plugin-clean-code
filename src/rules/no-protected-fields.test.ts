import { runRuleTests } from "../testing/run-rule-tests.ts";
import rule from "./no-protected-fields.ts";

runRuleTests("no-protected-fields", rule, {
  valid: [
    { name: "a private field", code: "class A {\n  private count = 0;\n}" },
    { name: "a `#private` field", code: "class A {\n  #count = 0;\n}" },
    { name: "a public field", code: "class A {\n  count = 0;\n  public total = 0;\n}" },
    { name: "a protected method is not a variable", code: "class A {\n  protected next(): number { return 1; }\n}" },
    { name: "a protected accessor pair is not a variable", code: "class A {\n  protected get size(): number { return 1; }\n  protected set size(v: number) {}\n}" },
    { name: "a protected constructor", code: "class A {\n  protected constructor() {}\n}" },
    { name: "a private parameter property", code: "class A {\n  constructor(private readonly n: number) {}\n}" },
    { name: "plain JavaScript", code: "class A {\n  count = 0;\n}", filename: "file.js" },
  ],
  invalid: [
    {
      name: "a protected field",
      code: "class Account {\n  protected balance = 0;\n}",
      output: null,
      errors: [{ messageId: "protectedField", data: { name: "balance" }, line: 2 }],
    },
    {
      name: "protected readonly and static fields",
      code: "class A {\n  protected readonly id: string = \"a\";\n  protected static count = 0;\n}",
      output: null,
      errors: [
        { messageId: "protectedField", data: { name: "id" }, line: 2 },
        { messageId: "protectedField", data: { name: "count" }, line: 3 },
      ],
    },
    {
      name: "a protected abstract field",
      code: "abstract class Shape {\n  protected abstract sides: number;\n}",
      output: null,
      errors: [{ messageId: "protectedField", data: { name: "sides" } }],
    },
    {
      name: "a protected parameter property",
      code: "class A {\n  constructor(protected readonly name: string, protected size = 1) {}\n}",
      output: null,
      errors: [
        { messageId: "protectedField", data: { name: "name" } },
        { messageId: "protectedField", data: { name: "size" } },
      ],
    },
    {
      name: "a protected auto-accessor holds a variable",
      code: "class A {\n  protected accessor total = 0;\n}",
      output: null,
      errors: [{ messageId: "protectedField", data: { name: "total" } }],
    },
    {
      name: "a protected field without an initializer",
      code: "class A {\n  protected 'quoted key': number;\n}",
      output: null,
      errors: [{ messageId: "protectedField", data: { name: "quoted key" } }],
    },
  ],
});
