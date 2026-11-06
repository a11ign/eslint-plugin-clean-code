/**
 * Recognises the test functions of the common runners (Jest, Vitest, Mocha, `node:test`, rstest, Bun) for the test-file
 * rules of chapters 14 and 15: `it`, `test` and `describe`, their `x` forms (`xit`, `xtest`, `xdescribe`), their
 * modifiers (`.skip`, `.only`, `.todo`, `.concurrent`, `.each(table)` and the like) and `node:test`'s options object
 * (`it("name", { skip: true }, fn)`).
 */
import { asTs, isFunction, type FunctionNode, type TSESTree } from "./ast.ts";

export type TestKind = "it" | "test" | "describe";

const BASES = new Map<string, { kind: TestKind; disabledByPrefix: boolean }>([
  ["it", { kind: "it", disabledByPrefix: false }],
  ["test", { kind: "test", disabledByPrefix: false }],
  ["describe", { kind: "describe", disabledByPrefix: false }],
  ["xit", { kind: "it", disabledByPrefix: true }],
  ["xtest", { kind: "test", disabledByPrefix: true }],
  ["xdescribe", { kind: "describe", disabledByPrefix: true }],
]);

/** Modifiers a runner chains onto a test function. Any other property means the call is not a test call. */
const MODIFIERS = new Set(["skip", "only", "todo", "concurrent", "sequential", "serial", "each", "fails", "failing", "skipIf", "runIf", "if"]);

/** Modifiers that are themselves called with an argument before the test is (`it.each(table)(…)`, `it.skipIf(c)(…)`). */
const CALLED_MODIFIERS = new Set(["each", "skipIf", "runIf", "if"]);

/** What a call to a test function is. */
export interface TestCall {
  call: TSESTree.CallExpression;
  kind: TestKind;
  /** The base name as written: `it`, `xit`, `describe` … */
  base: TSESTree.Identifier;
  /** The modifiers in order, such as `["skip"]` for `it.skip(…)` or `["concurrent", "only"]`. */
  modifiers: TSESTree.Identifier[];
  /** The options object, `node:test`'s second argument (`it("name", { skip: true }, fn)`), when it is written inline. */
  options: TSESTree.ObjectExpression | null;
  /** The test or group's own function, when it is written inline as the last argument. */
  callback: FunctionNode | null;
}

/** Reads `it`, `it.skip`, `it.each(table)`, `it.concurrent.only` … into a base and its modifiers, or `null`. */
function readCallee(callee: TSESTree.Node): { base: TSESTree.Identifier; modifiers: TSESTree.Identifier[] } | null {
  if (callee.type === "Identifier") return BASES.has(callee.name) ? { base: callee, modifiers: [] } : null;
  if (callee.type === "CallExpression") {
    const inner = readCallee(callee.callee);
    const last = inner?.modifiers.at(-1);
    return last && CALLED_MODIFIERS.has(last.name) ? inner : null;
  }
  if (callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier" && MODIFIERS.has(callee.property.name)) {
    const inner = readCallee(callee.object);
    return inner ? { base: inner.base, modifiers: [...inner.modifiers, callee.property] } : null;
  }
  return null;
}

/** The test call `node` is, or `null` when it is any other call. `it.each(table)` alone is not a test call; the call it returns is. */
export function readTestCall(node: unknown): TestCall | null {
  const call = asTs<TSESTree.Node>(node);
  if (call.type !== "CallExpression") return null;
  const read = readCallee(call.callee);
  if (!read) return null;
  if (call.parent?.type === "CallExpression" && call.parent.callee === call && CALLED_MODIFIERS.has(read.modifiers.at(-1)?.name ?? "")) return null;
  const kind = BASES.get(read.base.name)!.kind;
  const options = call.arguments.find((argument): argument is TSESTree.ObjectExpression => argument.type === "ObjectExpression") ?? null;
  const last = call.arguments.at(-1);
  return { call, kind, ...read, options, callback: isFunction(last) ? last : null };
}

/** The value of a plain (non-computed, non-spread) property `name` in an options object. */
export function optionProperty(options: TSESTree.ObjectExpression | null, name: string): TSESTree.Property | null {
  if (!options) return null;
  for (const property of options.properties) {
    if (property.type !== "Property" || property.computed) continue;
    const key = property.key.type === "Identifier" ? property.key.name : property.key.type === "Literal" ? String(property.key.value) : null;
    if (key === name) return property;
  }
  return null;
}

function isTrueLiteral(property: TSESTree.Property | null): boolean {
  return property?.value.type === "Literal" && property.value.value === true;
}

/** How a test is disabled: the node that disables it, or `null` when it runs. `.todo` is not counted as disabled. */
export function disablingNode(test: TestCall): TSESTree.Node | null {
  if (BASES.get(test.base.name)!.disabledByPrefix) return test.base;
  const skip = test.modifiers.find((modifier) => modifier.name === "skip");
  if (skip) return skip;
  const option = optionProperty(test.options, "skip");
  return isTrueLiteral(option) ? option : null;
}

/** Whether the test is marked as a to-do: `.todo`, or `{ todo: true }` / `{ todo: "reason" }`. */
export function isTodo(test: TestCall): boolean {
  if (test.modifiers.some((modifier) => modifier.name === "todo")) return true;
  const option = optionProperty(test.options, "todo");
  return option !== null && !(option.value.type === "Literal" && (option.value.value === false || option.value.value === null || option.value.value === ""));
}

/** Whether the test is skipped in any way: disabled, or `{ skip: "reason" }`, which `node:test` reads as skip with a message. */
export function isSkipped(test: TestCall): boolean {
  if (disablingNode(test)) return true;
  const option = optionProperty(test.options, "skip");
  return option?.value.type === "Literal" && typeof option.value.value === "string" && option.value.value !== "";
}

/** The inline callback of a hook call (such as `beforeEach(() => { … })`) when `node` is a call to one of `names`. */
export function hookCallback(node: TSESTree.Node, names: ReadonlySet<string>): FunctionNode | null {
  if (node.type !== "CallExpression" || node.callee.type !== "Identifier" || !names.has(node.callee.name)) return null;
  const last = node.arguments.at(-1);
  return isFunction(last) ? last : null;
}
