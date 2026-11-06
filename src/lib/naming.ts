/**
 * Helpers for the naming rules of chapter 4 (NAM-02, NAM-04, NAM-08 to NAM-12): reading the scope analysis both linters
 * share (typescript-eslint's scope manager, under ESLint and under Oxlint), finding where a binding is visible, and
 * deciding when a rename is safe.
 */
import type { Rule, Scope, SourceCode } from "eslint";
import { asTs, isFunction, type FunctionNode, type Node } from "./ast.ts";

export type ScopeT = Scope.Scope;
export type VariableT = Scope.Variable;

/** Every scope of the file, from the scope manager both linters expose on `sourceCode`. */
export function allScopes(sourceCode: SourceCode): ScopeT[] {
  return sourceCode.scopeManager?.scopes ?? [];
}

/**
 * The bindings this file declares: every variable with a declaration. The global scope's implicit and library variables
 * (ESLint's parser adds the `lib` names, Oxlint adds none) have no declaration, so both linters see the same list.
 */
export function declaredVariables(sourceCode: SourceCode): VariableT[] {
  return allScopes(sourceCode).flatMap((scope) => scope.variables.filter((variable) => variable.defs.length > 0));
}

/** `scope` and every scope nested in it. */
export function scopeAndDescendants(scope: ScopeT): ScopeT[] {
  const result: ScopeT[] = [];
  const pending = [scope];
  while (pending.length > 0) {
    const next = pending.pop() as ScopeT;
    result.push(next);
    pending.push(...next.childScopes);
  }
  return result;
}

/** `scope` and every scope it is nested in, up to the global scope. */
export function scopeAndAncestors(scope: ScopeT): ScopeT[] {
  const result: ScopeT[] = [];
  for (let current: ScopeT | null = scope; current; current = current.upper) result.push(current);
  return result;
}

/** The variable `name` resolves to from `scope`, looking outward, or `null` for an undeclared (global) name. */
export function lookUp(scope: ScopeT, name: string): VariableT | null {
  for (const current of scopeAndAncestors(scope)) {
    const variable = current.set.get(name);
    if (variable && variable.defs.length > 0) return variable;
  }
  return null;
}

/**
 * The names of the ECMAScript global objects and of TypeScript's global utility types. A rename never takes one of these:
 * it would shadow the global for the code it is visible in. Listed here rather than read from the scope manager, because
 * ESLint's parser declares the `lib` globals and Oxlint's declares none, and a rule must decide the same way under both.
 */
export const STANDARD_GLOBALS: ReadonlySet<string> = new Set([
  "AggregateError", "Array", "ArrayBuffer", "Atomics", "BigInt", "BigInt64Array", "BigUint64Array", "Boolean", "DataView",
  "Date", "decodeURI", "decodeURIComponent", "encodeURI", "encodeURIComponent", "Error", "escape", "eval", "EvalError",
  "FinalizationRegistry", "Float16Array", "Float32Array", "Float64Array", "Function", "globalThis", "Infinity", "Int8Array",
  "Int16Array", "Int32Array", "Intl", "isFinite", "isNaN", "Iterator", "JSON", "Map", "Math", "NaN", "Number", "Object",
  "parseFloat", "parseInt", "Promise", "Proxy", "RangeError", "ReferenceError", "Reflect", "RegExp", "Set",
  "SharedArrayBuffer", "String", "Symbol", "SyntaxError", "TypeError", "Uint8Array", "Uint8ClampedArray", "Uint16Array",
  "Uint32Array", "undefined", "unescape", "URIError", "WeakMap", "WeakRef", "WeakSet", "arguments",
  "Awaited", "Partial", "Required", "Readonly", "Record", "Pick", "Omit", "Exclude", "Extract", "NonNullable", "Parameters",
  "ConstructorParameters", "ReturnType", "InstanceType", "ThisParameterType", "OmitThisParameter", "ThisType", "Uppercase",
  "Lowercase", "Capitalize", "Uncapitalize", "NoInfer", "PropertyKey", "PropertyDescriptor", "PromiseLike", "ArrayLike",
  "Iterable", "IterableIterator", "AsyncIterable", "AsyncIterator", "AsyncIterableIterator", "Generator", "AsyncGenerator",
  "ReadonlyArray", "ReadonlyMap", "ReadonlySet", "TemplateStringsArray", "Disposable", "AsyncDisposable", "CallableFunction",
  "NewableFunction", "IArguments", "TypedPropertyDescriptor", "ClassDecorator", "MethodDecorator", "PropertyDecorator",
  "ParameterDecorator",
]);

const RESERVED = new Set([
  "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete", "do", "else", "enum", "export",
  "extends", "false", "finally", "for", "function", "if", "import", "in", "instanceof", "new", "null", "return", "super",
  "switch", "this", "throw", "true", "try", "typeof", "var", "void", "while", "with", "yield", "let", "static", "implements",
  "interface", "package", "private", "protected", "public", "await", "arguments", "eval", "async", "of", "type",
  "any", "unknown", "never", "object", "string", "number", "boolean", "symbol", "bigint",
]);

/** Whether `name` can be written as a binding name in strict TypeScript code. */
export function isBindableName(name: string): boolean {
  return /^[A-Za-z_$][\w$]*$/.test(name) && !RESERVED.has(name);
}

/**
 * Lowercases the first word of a name the way camel case writes it: `Name` gives `name`, `URL` gives `url`, `URLPath`
 * gives `urlPath` and `HTTP2Server` gives `http2Server`.
 */
export function lowerFirstWord(name: string): string {
  const capitals = /^[A-Z]+/.exec(name)?.[0] ?? "";
  if (capitals.length <= 1) return name.charAt(0).toLowerCase() + name.slice(1);
  const nextIsLower = /^[a-z]/.test(name.slice(capitals.length));
  const lowered = nextIsLower ? capitals.slice(0, -1) : capitals;
  return lowered.toLowerCase() + name.slice(lowered.length);
}

/** Removes the TypeScript wrappers (`as`, `satisfies`, `!`, `<T>x`) that leave the run-time value unchanged. */
export function unwrapTypeScript(node: Node | null | undefined): Node | null {
  let current = node ?? null;
  while (current && (current.type === "TSAsExpression" || current.type === "TSSatisfiesExpression" || current.type === "TSNonNullExpression" || current.type === "TSTypeAssertion")) {
    current = current.expression;
  }
  return current;
}

/**
 * Whether `node` is an anonymous function or class, which takes the name of the binding it is assigned to (named
 * evaluation): renaming that binding would change the value's `name` property.
 */
export function isAnonymousFunctionOrClass(node: Node | null | undefined): boolean {
  const value = unwrapTypeScript(node);
  if (!value) return false;
  if (value.type === "ArrowFunctionExpression") return true;
  return (value.type === "FunctionExpression" || value.type === "ClassExpression") && !value.id;
}

/** Whether binding `identifier` takes the name of an anonymous function or class assigned to it right there. */
export function receivesNamedFunction(identifier: Node): boolean {
  const parent = identifier.parent;
  if (parent?.type === "VariableDeclarator" && parent.id === identifier) return isAnonymousFunctionOrClass(parent.init);
  if ((parent?.type === "AssignmentExpression" || parent?.type === "AssignmentPattern") && parent.left === identifier) {
    return isAnonymousFunctionOrClass(parent.right);
  }
  return false;
}

/** Whether `identifier` is written as a shorthand property (`{ m_count }`) in an object literal or a destructuring pattern. */
export function isShorthand(identifier: Node): boolean {
  let child: Node = identifier;
  let parent = identifier.parent;
  if (parent?.type === "AssignmentPattern" && parent.left === child) {
    child = parent;
    parent = parent.parent;
  }
  return parent?.type === "Property" && parent.shorthand && parent.value === child;
}

/** Whether `node` is inside an ambient context: a `declare` declaration, a `declare module`, `declare global` or `.d.ts` file. */
export function isAmbient(node: Node, filename: string): boolean {
  if (/\.d\.[cm]?ts$/.test(filename)) return true;
  for (let current: Node | undefined = node; current; current = current.parent) {
    if ((current as { declare?: boolean }).declare === true) return true;
    if (current.type === "TSModuleDeclaration" && current.kind === "global") return true;
  }
  return false;
}

/** The shared module test (see `isModule`), under the name the naming rules use. */
export { isModule as isEsModuleFile } from "./ast.ts";

/** Whether `identifier` is the name in an `import` or `export` specifier, `export default`, `export =` or `import x =`. */
export function isInImportOrExport(identifier: Node): boolean {
  const parent = identifier.parent;
  if (!parent) return false;
  if (/^(Import|Export)(Default|Namespace)?Specifier$/.test(parent.type)) return true;
  return parent.type === "ExportDefaultDeclaration" || parent.type === "TSExportAssignment" || parent.type === "TSImportEqualsDeclaration";
}

/** Whether the declaration of binding `identifier` is exported with it (`export const m_x = 1`, `export interface IShape {}`). */
export function isExportedDeclaration(identifier: Node): boolean {
  for (let current: Node | undefined = identifier.parent; current; current = current.parent) {
    if (current.type === "ExportNamedDeclaration" || current.type === "ExportDefaultDeclaration") return true;
    if (isFunction(current) || current.type === "BlockStatement" || current.type === "ClassBody" || current.type === "TSModuleBlock") return false;
  }
  return false;
}

/**
 * Whether `name` is free for a binding that lives in `scope`: no declaration of it in `scope`, in a scope around it or in
 * a scope inside it, no reference to it (resolved or not) from `scope` or a scope inside it, and not a standard global.
 */
export function isNameFree(scope: ScopeT, name: string): boolean {
  if (STANDARD_GLOBALS.has(name)) return false;
  const declaredAround = scopeAndAncestors(scope).some((current) => current.set.get(name)?.defs.length);
  if (declaredAround) return false;
  return !scopeAndDescendants(scope).some((current) => current.set.get(name)?.defs.length || current.references.some((reference) => reference.identifier.name === name));
}

/** Whether code in `scope` or a scope inside it calls `eval`, which can read any binding by its name. */
export function usesEval(scope: ScopeT): boolean {
  return scopeAndDescendants(scope).some((current) => current.references.some((reference) => reference.identifier.name === "eval"));
}

/** The text range of an identifier's name alone, without the type annotation typescript-eslint includes in its range. */
export function nameRange(identifier: Node, name: string): [number, number] {
  const start = identifier.range[0];
  return [start, start + name.length];
}

/** Replaces the name at each identifier, once per position. */
export function renameAll(fixer: Rule.RuleFixer, identifiers: Node[], oldName: string, newName: string): Rule.Fix[] {
  const starts = new Set<number>();
  const fixes: Rule.Fix[] = [];
  for (const identifier of identifiers) {
    if (starts.has(identifier.range[0])) continue;
    starts.add(identifier.range[0]);
    fixes.push(fixer.replaceTextRange(nameRange(identifier, oldName), newName));
  }
  return fixes;
}

/** The identifier nodes of a variable: its declarations and its references. */
export function variableIdentifiers(variable: VariableT): Node[] {
  return [...variable.defs.map((def) => asTs(def.name)), ...variable.references.map((reference) => asTs(reference.identifier))];
}

/** The name a key spells, when it is not computed: an identifier, a `#private` name or a string. */
export function keyName(key: Node, computed: boolean): string | null {
  if (computed) return null;
  if (key.type === "PrivateIdentifier" || key.type === "Identifier") return key.name;
  return key.type === "Literal" && typeof key.value === "string" ? key.value : null;
}

/** The name a function is known by, including a `#private` method's name and a key written as a string. */
export function predicateCandidateName(node: FunctionNode): string | null {
  const parent = node.parent;
  if (parent?.type === "MethodDefinition" || parent?.type === "PropertyDefinition" || parent?.type === "Property") return keyName(parent.key, parent.computed);
  if (node.id) return node.id.name;
  if (parent?.type === "VariableDeclarator" && parent.id.type === "Identifier") return parent.id.name;
  if (parent?.type === "AssignmentExpression" && parent.left.type === "Identifier") return parent.left.name;
  return null;
}

/** The number of lines a node spans. */
export function lineSpan(node: Node): number {
  return node.loc.end.line - node.loc.start.line + 1;
}
