import { runTypedRuleTests, runWithoutTypeInformation } from "../testing/run-typed-rule-tests.ts";
import rule from "./predicate-returns-boolean.ts";

runTypedRuleTests("predicate-returns-boolean", rule, {
  valid: [
    "function isEmpty(items: unknown[]): boolean { return items.length === 0; }",
    "function hasItems(items: unknown[]) { return items.length > 0; }",
    "const canRetry = (attempts: number) => attempts < 3;",
    "function isAlwaysTrue(): true { return true; }",
    { name: "a type predicate returns a boolean", code: "function isString(value: unknown): value is string { return typeof value === 'string'; }" },
    { name: "an async predicate returns a promise of a boolean", code: "async function shouldRefresh(age: number) { return age > 60; }" },
    { name: "a predicate declared to return a promise of a boolean", code: "function hasAccess(id: string): Promise<boolean> { return Promise.resolve(id.length > 0); }" },
    { name: "a method returning a boolean, and a getter", code: "class Stack { private items: number[] = []; isEmpty(): boolean { return this.items.length === 0; } get hasTop() { return this.items.length > 0; } }" },
    { name: "an object member", code: "const policy = { canDelete(role: string) { return role === 'admin'; } };" },
    { name: "a setter's name is the property's", code: "class Door { private open = false; set isOpen(value: boolean) { this.open = value; } }" },
    { name: "a function that never returns", code: "function isBroken(): never { throw new Error('x'); }" },
    { name: "a function whose result is `any`", code: "function isWhatever(x: any) { return x.check(); }" },
    { name: "not a predicate name: `is` is not followed by a new word", code: "function island(): string { return 'x'; }" },
    { name: "not a predicate name: `has` is not followed by a new word", code: "function hash(text: string): number { return text.length; }" },
    { name: "not a predicate name: `can` is not followed by a new word", code: "function canonical(): string { return 'x'; }" },
    { name: "not a predicate name: `should` is not followed by a new word", code: "function shoulder(): number { return 1; }" },
  ],
  invalid: [
    {
      name: "a predicate name that returns a value",
      code: "interface User { id: number }\nfunction hasUser(users: User[], id: number) { return users.find((u) => u.id === id); }",
      errors: [{ messageId: "notBoolean", line: 2, data: { name: "hasUser", type: "User | undefined" } }],
    },
    {
      name: "a predicate that returns nothing",
      code: "let count = 0;\nfunction isMultipleOfNthPrimeFactor(n: number): void { count += n; }",
      errors: [{ messageId: "notBoolean", data: { name: "isMultipleOfNthPrimeFactor", type: "void" } }],
    },
    {
      name: "a boolean that may be undefined",
      code: "function shouldStop(flags: Map<string, boolean>) { return flags.get('stop'); }",
      errors: [{ messageId: "notBoolean", data: { name: "shouldStop", type: "boolean | undefined" } }],
    },
    {
      name: "an async predicate that resolves to a number",
      code: "async function canRetry(attempts: number) { return 3 - attempts; }",
      errors: [{ messageId: "notBoolean", data: { name: "canRetry", type: "Promise<number>" } }],
    },
    {
      name: "a method, a getter, an arrow and an object member",
      code: "class Cart { private items: string[] = []; isEmpty() { return this.items.length; } get hasDiscount(): string { return ''; } }\nconst isReady = () => 'yes';\nconst api = { canEdit() { return 1; } };",
      errors: [
        { messageId: "notBoolean", line: 1, data: { name: "isEmpty", type: "number" } },
        { messageId: "notBoolean", line: 1, data: { name: "hasDiscount", type: "string" } },
        { messageId: "notBoolean", line: 2, data: { name: "isReady", type: "string" } },
        { messageId: "notBoolean", line: 3, data: { name: "canEdit", type: "number" } },
      ],
    },
  ],
});

runWithoutTypeInformation("predicate-returns-boolean", rule, ["function isEmpty(items: unknown[]) { return items.length; }"]);
