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

/** Reads `callee`, such as `it`, `it.skip`, `it.each(table)` or `it.concurrent.only` …, into a base and its modifiers, or `null`. */
function readCallee(callee: TSESTree.Node): CalleeParts | null {
  if (callee.type === "Identifier") return BASES.has(callee.name) ? { base: callee, modifiers: [] } : null;
  if (callee.type === "CallExpression") return readCalledCallee(callee);
  if (isModifierAccess(callee)) return withModifier(readCallee(callee.object), callee.property);
  return null;
}

/** A test callee's base name and its modifiers, in order. */
interface CalleeParts {
  base: TSESTree.Identifier;
  modifiers: TSESTree.Identifier[];
}

/** Reads a called `callee` such as `it.each(table)`: only a call to a modifier that returns the test function, such as `each`. */
function readCalledCallee(callee: TSESTree.CallExpression): CalleeParts | null {
  const inner = readCallee(callee.callee);
  const last = inner?.modifiers.at(-1);
  return last && CALLED_MODIFIERS.has(last.name) ? inner : null;
}

/** Whether `node` reads a known modifier by name: `.skip`, `.only`, `.each` … */
function isModifierAccess(node: TSESTree.Node): node is TSESTree.MemberExpression & { property: TSESTree.Identifier } {
  if (node.type !== "MemberExpression" || node.computed) return false;
  return node.property.type === "Identifier" && MODIFIERS.has(node.property.name);
}

/** The callee `inner` with `modifier` added after its modifiers, or `null` when `inner` is not a test callee. */
function withModifier(inner: CalleeParts | null, modifier: TSESTree.Identifier): CalleeParts | null {
  return inner ? { base: inner.base, modifiers: [...inner.modifiers, modifier] } : null;
}

/** Whether `test` is marked as a to-do: `.todo`, or `{ todo: true }` / `{ todo: "reason" }`. */
export function isTodo(test: TestCall): boolean {
  if (test.modifiers.some((modifier) => modifier.name === "todo")) return true;
  const option = optionProperty(test.options, "todo");
  return option !== null && !(option.value.type === "Literal" && (option.value.value === false || option.value.value === null || option.value.value === ""));
}

/** The value of a plain (non-computed, non-spread) property `name` in the `options` object. */
export function optionProperty(options: TSESTree.ObjectExpression | null, name: string): TSESTree.Property | null {
  if (!options) return null;
  return options.properties.find((property): property is TSESTree.Property => isPlainPropertyNamed(property, name)) ?? null;
}

/** Whether `property` is a plain (non-computed, non-spread) property whose key spells `name`. */
function isPlainPropertyNamed(property: TSESTree.ObjectLiteralElement, name: string): boolean {
  if (property.type !== "Property" || property.computed) return false;
  return plainKeyName(property.key) === name;
}

/** The name `key` spells when it is an identifier or a literal, or `null` for any other key. */
function plainKeyName(key: TSESTree.PropertyName): string | null {
  if (key.type === "Identifier") return key.name;
  return key.type === "Literal" ? String(key.value) : null;
}

/** Whether `test` is skipped in any way: disabled, or `{ skip: "reason" }`, which `node:test` reads as skip with a message. */
export function isSkipped(test: TestCall): boolean {
  if (disablingNode(test)) return true;
  const option = optionProperty(test.options, "skip");
  return option?.value.type === "Literal" && typeof option.value.value === "string" && option.value.value !== "";
}

/** How `test` is disabled: the node that disables it, or `null` when it runs. `.todo` is not counted as disabled. */
export function disablingNode(test: TestCall): TSESTree.Node | null {
  if (BASES.get(test.base.name)!.disabledByPrefix) return test.base;
  const skip = test.modifiers.find((modifier) => modifier.name === "skip");
  if (skip) return skip;
  const option = optionProperty(test.options, "skip");
  return isTrueLiteral(option) ? option : null;
}

function isTrueLiteral(property: TSESTree.Property | null): boolean {
  return property?.value.type === "Literal" && property.value.value === true;
}

/** The inline callback of a hook call (such as `beforeEach(() => { … })`) when `node` is a call to one of `names`. */
export function hookCallback(node: TSESTree.Node, names: ReadonlySet<string>): FunctionNode | null {
  if (node.type !== "CallExpression" || node.callee.type !== "Identifier" || !names.has(node.callee.name)) return null;
  const last = node.arguments.at(-1);
  return isFunction(last) ? last : null;
}
