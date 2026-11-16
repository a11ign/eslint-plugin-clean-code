/**
 * Helpers for the rules about objects, data structures and classes (FH-04, OBJ-02 to OBJ-05, ONE-05): reading class
 * members, walking a function's body, and finding the class a `this` refers to. They read only the syntax tree, so they
 * work the same under ESLint and Oxlint.
 */
import { isFunction, type FunctionNode, type Node, type TSESTree } from "./ast.ts";

export type ClassNode = TSESTree.ClassDeclaration | TSESTree.ClassExpression;
export type ClassMember = TSESTree.ClassElement;

const SKIPPED_KEYS = new Set(["parent", "loc", "range", "start", "end", "type", "typeAnnotation", "returnType", "typeParameters", "decorators"]);

/** The member a `this.x`, `this["x"]`, `this.#x` or `(this as T).x` expression reads, or null for anything else. */
export function thisMemberName(expression: TSESTree.Node | null | undefined): string | null {
  const member = expression ? unwrapTs(expression) : null;
  if (member?.type !== "MemberExpression" || !isThis(member.object)) return null;
  return keyName(member.property, { computed: member.computed });
}

/** Whether an expression is `this`, also behind `as`, `satisfies`, `!` or an angle-bracket assertion (`return this as this`). */
export function isThis(expression: TSESTree.Node | null | undefined): boolean {
  return expression ? unwrapTs(expression).type === "ThisExpression" : false;
}

/** The name of a non-computed member key: `x`, `"x"`, or `#x` for a private name. */
export function keyName(key: TSESTree.Node, { computed }: { computed: boolean }): string | null {
  if (key.type === "PrivateIdentifier") return `#${key.name}`;
  if (computed) return key.type === "Literal" && typeof key.value === "string" ? key.value : null;
  if (key.type === "Identifier") return key.name;
  if (key.type === "Literal") return String(key.value);
  return null;
}

/** The name a class is known by: its own id, or the variable it is assigned to. */
export function className(node: ClassNode): string {
  if (node.id) return node.id.name;
  const parent = node.parent;
  if (parent?.type === "VariableDeclarator" && parent.id.type === "Identifier") return parent.id.name;
  return "(anonymous)";
}

export function classOfBody(body: TSESTree.ClassBody): ClassNode {
  return body.parent as ClassNode;
}

/** Whether a member is non-public: TypeScript `private` or `protected`, or a `#private` name. */
export function isHidden(member: ClassMember | TSESTree.TSParameterProperty): boolean {
  if (member.type === "TSParameterProperty") return member.accessibility === "private" || member.accessibility === "protected";
  if (member.type === "StaticBlock" || member.type === "TSIndexSignature") return true;
  return member.accessibility === "private" || member.accessibility === "protected" || member.key.type === "PrivateIdentifier";
}

/** Whether a member is a private field: TypeScript `private`, or a `#private` name. Instance fields only. */
export function isPrivateField(member: ClassMember): boolean {
  if (member.type !== "PropertyDefinition" || member.static || isFunction(member.value)) return false;
  return member.accessibility === "private" || member.key.type === "PrivateIdentifier";
}

/** The TypeScript parameter properties of a constructor (`constructor(private x: number)`). */
export function parameterProperties(body: TSESTree.ClassBody): TSESTree.TSParameterProperty[] {
  const constructor = constructorOf(body);
  return (constructor?.params ?? []).filter((param): param is TSESTree.TSParameterProperty => param.type === "TSParameterProperty");
}

/** The constructor of a class body, if it has one with a body. */
export function constructorOf(body: TSESTree.ClassBody): TSESTree.FunctionExpression | null {
  for (const member of body.body) {
    if (member.type === "MethodDefinition" && member.kind === "constructor" && member.value.type === "FunctionExpression") return member.value;
  }
  return null;
}

export function parameterPropertyName(param: TSESTree.TSParameterProperty): string | null {
  const binding = param.parameter.type === "AssignmentPattern" ? param.parameter.left : param.parameter;
  return binding.type === "Identifier" ? binding.name : null;
}

/** Whether a method is a fluent setter: it returns, and every `return` returns `this` (also `this as this`, `this!`). */
export function returnsOnlyThis(fn: FunctionNode): boolean {
  const values = returnedValues(fn);
  return values.length > 0 && values.every(isThis);
}

/** The values a function returns: each `return`'s argument, or the body of an arrow function with an expression body. */
export function returnedValues(fn: FunctionNode): Array<TSESTree.Expression | null> {
  if (fn.body && fn.body.type !== "BlockStatement") return [fn.body];
  return returnStatements(fn).map((statement) => statement.argument);
}

/** The `return` statements of a function itself, not of the functions nested in it. */
export function returnStatements(fn: FunctionNode): TSESTree.ReturnStatement[] {
  const returns: TSESTree.ReturnStatement[] = [];
  if (fn.body?.type !== "BlockStatement") return returns;
  walk(fn.body, (node) => {
    if (node.type === "ReturnStatement") returns.push(node);
  });
  return returns;
}

/**
 * Calls `visit` on every node under `root` that runs when `root` runs: nested functions and classes are visited but not
 * entered. `walkIntoFunctions` enters them too.
 */
export function walk(root: Node, visit: (node: Node) => void): void {
  for (const child of childNodes(root)) {
    visit(child);
    if (!opensScope(child)) walk(child, visit);
  }
}

/** Calls `visit` on every node under `root`, entering nested functions and classes. */
export function walkIntoFunctions(root: Node, visit: (node: Node) => void): void {
  for (const child of childNodes(root)) {
    visit(child);
    walkIntoFunctions(child, visit);
  }
}

/** Whether a node is a function or a class, whose code does not run when the code around it runs. */
function opensScope(node: Node): boolean {
  return isFunction(node) || node.type === "ClassDeclaration" || node.type === "ClassExpression";
}

/** The child nodes of `node`, in no particular order, read from its own keys so it works with either linter's tree. */
export function childNodes(node: Node): Node[] {
  const children: Node[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (SKIPPED_KEYS.has(key)) continue;
    if (Array.isArray(value)) children.push(...value.filter(isNode));
    else if (isNode(value)) children.push(value);
  }
  return children;
}

function isNode(value: unknown): value is Node {
  return typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string";
}

/** The class member whose code a node runs in, and that member's class body, as `this` sees it. */
export interface ThisOwner {
  body: TSESTree.ClassBody;
  member: ClassMember;
  isStatic: boolean;
}

/**
 * The class that `this` refers to at `node`: arrow functions keep the enclosing `this`, while any other function that is
 * not a class member's own function binds a new one, so there is no class.
 */
export function thisOwner(node: Node): ThisOwner | null {
  let current: Node | undefined = node.parent;
  let child: Node = node;
  while (current && !endsThisSearch(current)) {
    child = current;
    current = current.parent;
  }
  if (current?.type !== "ClassBody") return null;
  return ownerInBody(current, child as ClassMember);
}

/** Whether the search for `this`'s class stops at `node`: at a class body, or at a function that binds its own `this`. */
function endsThisSearch(node: Node): boolean {
  return node.type === "ClassBody" || bindsOwnThis(node);
}

/** Whether a node is a non-arrow function that is not a class member's own function, so it binds a new `this`. */
function bindsOwnThis(node: Node): boolean {
  if (node.type !== "FunctionDeclaration" && node.type !== "FunctionExpression") return false;
  return !isClassMemberFunction(node);
}

function isClassMemberFunction(fn: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression): boolean {
  const parent = fn.parent;
  const isMember = parent?.type === "MethodDefinition" || parent?.type === "PropertyDefinition";
  return isMember && parent.value === fn;
}

/** The owner of `this` in `member` of class `body`; an index signature has no code, so no owner. */
function ownerInBody(body: TSESTree.ClassBody, member: ClassMember): ThisOwner | null {
  if (member.type === "TSIndexSignature") return null;
  return { body, member, isStatic: member.type === "StaticBlock" || Boolean(member.static) };
}

/** The class member a `this.name()` call reaches, from the members on the same side (static or instance). */
export function findMethod(owner: ThisOwner, name: string): FunctionNode | null {
  for (const member of owner.body.body) {
    const fn = isMethodNamed(owner, member, name) ? memberFunction(member) : null;
    if (fn) return fn;
  }
  return null;
}

/** Whether `member` is a plain method or field called `name`, on the same side (static or instance) as `owner`. */
function isMethodNamed(owner: ThisOwner, member: ClassMember, name: string): boolean {
  if (member.type === "StaticBlock" || member.type === "TSIndexSignature") return false;
  if (Boolean(member.static) !== owner.isStatic || memberName(member) !== name) return false;
  return member.type !== "MethodDefinition" || member.kind === "method";
}

/** The function a class member runs: a method's body, or a field initialised with a function. */
export function memberFunction(member: ClassMember): FunctionNode | null {
  if (member.type === "MethodDefinition" && member.value.type === "FunctionExpression") return member.value;
  if (member.type === "PropertyDefinition" && isFunction(member.value)) return member.value;
  return null;
}

/** A field or method's name, when it has a static, non-computed one. */
export function memberName(member: ClassMember): string | null {
  if (member.type === "StaticBlock" || member.type === "TSIndexSignature") return null;
  return keyName(member.key, { computed: member.computed });
}

/** Removes the wrappers that do not change which value an expression has: `x!`, `x as T`, `<T>x`, `x satisfies T`. */
export function unwrapTs(expression: TSESTree.Node): TSESTree.Node {
  let current = expression;
  while (isTsWrapper(current)) current = current.expression;
  return current;
}

type TsWrapper = TSESTree.TSNonNullExpression | TSESTree.TSAsExpression | TSESTree.TSTypeAssertion | TSESTree.TSSatisfiesExpression;

const TS_WRAPPER_TYPES: ReadonlySet<string> = new Set(["TSNonNullExpression", "TSAsExpression", "TSTypeAssertion", "TSSatisfiesExpression"]);

function isTsWrapper(node: TSESTree.Node): node is TsWrapper {
  return TS_WRAPPER_TYPES.has(node.type);
}
