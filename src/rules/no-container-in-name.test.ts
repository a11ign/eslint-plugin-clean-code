import { runTypedRuleTests, runWithoutTypeInformation } from "../testing/run-typed-rule-tests.ts";
import rule from "./no-container-in-name.ts";

const ACCOUNT = "interface Account { id: number }";

runTypedRuleTests("no-container-in-name", rule, {
  valid: [
    { name: "the name tells the truth: an array of accounts", code: `${ACCOUNT}\nconst accountList: Account[] = [];` },
    { name: "the name tells the truth: a readonly array", code: `${ACCOUNT}\nconst accountArray: readonly Account[] = [];` },
    { name: "the name tells the truth: a tuple", code: "const pairList: [number, string] = [1, 'a'];" },
    { name: "the name tells the truth: a typed array", code: "function bytes(byteArray: Uint8Array) { return byteArray.length; }" },
    { name: "the name tells the truth: an ArrayLike", code: "function rows(rowList: ArrayLike<string>) { return rowList.length; }" },
    { name: "the name tells the truth: a Map", code: `${ACCOUNT}\nconst accountMap = new Map<number, Account>();` },
    { name: "the name tells the truth: a ReadonlyMap", code: `${ACCOUNT}\nfunction read(accountMap: ReadonlyMap<number, Account>) { return accountMap.size; }` },
    { name: "the name tells the truth: a Set", code: "const seenSet = new Set<string>();" },
    { name: "the name tells the truth: a ReadonlySet", code: "function has(idSet: ReadonlySet<number>, id: number) { return idSet.has(id); }" },
    { name: "the name tells the truth: a WeakMap", code: "const cacheMap = new WeakMap<object, number>();" },
    { name: "the name tells the truth: a snake-case name", code: "const SEEN_SET = new Set<string>();" },
    { name: "the name tells the truth: an array or undefined", code: "const accountList: string[] | undefined = undefined;" },
    { name: "a subclass of the container", code: "class Registry extends Map<string, number> {}\nconst registryMap = new Registry();" },
    { name: "a project container named for what it is", code: "class LinkedList<T> { head?: T }\nconst accountList = new LinkedList<number>();" },
    { name: "words that only end in the letters, not the camel-case word", code: "const dataOffset = 4; const userSubset = 'a'; const bitmap = 1; const checklist = 'x';" },
    { name: "a function is named for what it does", code: "const loadAccountList = async () => [1, 2];" },
    { name: "`any` and `unknown` carry no type to check", code: "function f(itemList: any, otherList: unknown) { return [itemList, otherList]; }" },
    { name: "an unconstrained type parameter carries no type to check", code: "function g<T>(itemList: T) { return itemList; }" },
    { name: "a type parameter constrained to an array", code: "function h<T extends string[]>(itemList: T) { return itemList; }" },
  ],
  invalid: [
    {
      name: "the book's example: a grouping of accounts that is not a list",
      code: `${ACCOUNT}\nconst accountList = new Set<Account>();`,
      errors: [{ messageId: "falseContainer", line: 2, data: { name: "accountList", word: "List", type: "Set<Account>" } }],
    },
    {
      name: "a plain object named as a map",
      code: `${ACCOUNT}\ntype AccountMap = Record<string, Account>;\nfunction find(accountMap: AccountMap) { return accountMap.a; }`,
      errors: [{ messageId: "falseContainer", line: 3, data: { name: "accountMap", word: "Map", type: "AccountMap" } }],
    },
    {
      name: "an array named as a set",
      code: "const idSet: number[] = [];",
      errors: [{ messageId: "falseContainer", data: { name: "idSet", word: "Set", type: "number[]" } }],
    },
    {
      name: "a string named as an array",
      code: "const NAME_ARRAY = 'a,b';",
      errors: [{ messageId: "falseContainer", data: { name: "NAME_ARRAY", word: "Array", type: '"a,b"' } }],
    },
    {
      name: "destructured bindings, a parameter property, a class field and a default",
      code: "class Store { userMap = 'x'; constructor(private readonly itemSet: string[]) {} }\nfunction f({ tagList }: { tagList: string }, [rowArray]: number[], keyMap = 0) { return [tagList, rowArray, keyMap]; }",
      errors: [
        { messageId: "falseContainer", data: { name: "userMap", word: "Map", type: "string" } },
        { messageId: "falseContainer", data: { name: "itemSet", word: "Set", type: "string[]" } },
        { messageId: "falseContainer", data: { name: "tagList", word: "List", type: "string" } },
        { messageId: "falseContainer", data: { name: "rowArray", word: "Array", type: "number" } },
        { messageId: "falseContainer", data: { name: "keyMap", word: "Map", type: "number" } },
      ],
    },
    {
      name: "a union that is only partly the container",
      code: "declare const userList: string[] | Set<string>;",
      errors: [{ messageId: "falseContainer" }],
    },
  ],
});

runWithoutTypeInformation("no-container-in-name", rule, ["const accountList = new Set<number>();"]);
