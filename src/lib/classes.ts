/**
 * Helpers for the rules about objects, data structures and classes (FH-04, OBJ-02 to OBJ-05, ONE-05): reading class
 * members, walking a function's body, and finding the class a `this` refers to. They read only the syntax tree, so they
 * work the same under ESLint and Oxlint.
 */
import { isFunction, type FunctionNode, type Node, type TSESTree } from "./ast.ts";

export type ClassNode = TSESTree.ClassDeclaration | TSESTree.ClassExpression;
export type ClassMember = TSESTree.ClassElement;

const SKIPPED_KEYS = new Set(["parent", "loc", "range", "start", "end", "type", "typeAnnotation", "returnType", "typeParameters", "decorators"]);

function isNode(value: unknown): value is Node {
  return typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string";
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

/**
 * Calls `visit` on every node under `root`. Nested functions and classes are entered only when `intoFunctions` is set,
 * so by default the walk sees exactly the code that runs when `root` runs.
 */
export function walk(root: Node, visit: (node: Node) => void, intoFunctions = false): void {
  for (const child of childNodes(root)) {
    visit(child);
    const opensScope = isFunction(child) || child.type === "ClassDeclaration" || child.type === "ClassExpression";
    if (intoFunctions || !opensScope) walk(child, visit, intoFunctions);
  }
}

/** The name of a non-computed member key: `x`, `"x"`, or `#x` for a private name. */
export function keyName(key: TSESTree.Node, computed: boolean): string | null {
  if (key.type === "PrivateIdentifier") return `#${key.name}`;
  if (computed) return key.type === "Literal" && typeof key.value === "string" ? key.value : null;
  if (key.type === "Identifier") return key.name;
  if (key.type === "Literal") return String(key.value);
  return null;
}

/** Whether an expression is `this`, also behind `as`, `satisfies`, `!` or an angle-bracket assertion (`return this as this`). */
export function isThis(expression: TSESTree.Node | null | undefined): boolean {
  return expression ? unwrapTs(expression).type === "ThisExpression" : false;
}

/** The member a `this.x`, `this["x"]`, `this.#x` or `(this as T).x` expression reads, or null for anything else. */
export function thisMemberName(expression: TSESTree.Node | null | undefined): string | null {
  const member = expression ? unwrapTs(expression) : null;
  if (member?.type !== "MemberExpression" || !isThis(member.object)) return null;
  return keyName(member.property, member.computed);
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

/** A field or method's name, when it has a static, non-computed one. */
export function memberName(member: ClassMember): string | null {
  if (member.type === "StaticBlock" || member.type === "TSIndexSignature") return null;
  return keyName(member.key, member.computed);
}

/** The function a class member runs: a method's body, or a field initialised with a function. */
export function memberFunction(member: ClassMember): FunctionNode | null {
  if (member.type === "MethodDefinition" && member.value.type === "FunctionExpression") return member.value;
  if (member.type === "PropertyDefinition" && isFunction(member.value)) return member.value;
  return null;
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

/** The constructor of a class body, if it has one with a body. */
export function constructorOf(body: TSESTree.ClassBody): TSESTree.FunctionExpression | null {
  for (const member of body.body) {
    if (member.type === "MethodDefinition" && member.kind === "constructor" && member.value.type === "FunctionExpression") return member.value;
  }
  return null;
}

/** The TypeScript parameter properties of a constructor (`constructor(private x: number)`). */
export function parameterProperties(body: TSESTree.ClassBody): TSESTree.TSParameterProperty[] {
  const constructor = constructorOf(body);
  return (constructor?.params ?? []).filter((param): param is TSESTree.TSParameterProperty => param.type === "TSParameterProperty");
}

export function parameterPropertyName(param: TSESTree.TSParameterProperty): string | null {
  const binding = param.parameter.type === "AssignmentPattern" ? param.parameter.left : param.parameter;
  return binding.type === "Identifier" ? binding.name : null;
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

/** The values a function returns: each `return`'s argument, or the body of an arrow function with an expression body. */
export function returnedValues(fn: FunctionNode): Array<TSESTree.Expression | null> {
  if (fn.body && fn.body.type !== "BlockStatement") return [fn.body];
  return returnStatements(fn).map((statement) => statement.argument);
}

/** Whether a method is a fluent setter: it returns, and every `return` returns `this` (also `this as this`, `this!`). */
export function returnsOnlyThis(fn: FunctionNode): boolean {
  const values = returnedValues(fn);
  return values.length > 0 && values.every(isThis);
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
  while (current) {
    if (current.type === "ClassBody") {
      const member = child as ClassMember;
      if (member.type === "TSIndexSignature") return null;
      return { body: current, member, isStatic: member.type === "StaticBlock" || Boolean(member.static) };
    }
    if (current.type === "FunctionDeclaration" || current.type === "FunctionExpression") {
      const parent = current.parent;
      const isMemberFunction = (parent?.type === "MethodDefinition" || parent?.type === "PropertyDefinition") && parent.value === current;
      if (!isMemberFunction) return null;
    }
    child = current;
    current = current.parent;
  }
  return null;
}

/** The class member a `this.name()` call reaches, from the members on the same side (static or instance). */
export function findMethod(owner: ThisOwner, name: string): FunctionNode | null {
  for (const member of owner.body.body) {
    if (member.type === "StaticBlock" || member.type === "TSIndexSignature") continue;
    if (Boolean(member.static) !== owner.isStatic || memberName(member) !== name) continue;
    if (member.type === "MethodDefinition" && member.kind !== "method") continue;
    const fn = memberFunction(member);
    if (fn) return fn;
  }
  return null;
}

/** Removes the wrappers that do not change which value an expression has: `x!`, `x as T`, `<T>x`, `x satisfies T`. */
export function unwrapTs(expression: TSESTree.Node): TSESTree.Node {
  let current = expression;
  while (current.type === "TSNonNullExpression" || current.type === "TSAsExpression" || current.type === "TSTypeAssertion" || current.type === "TSSatisfiesExpression") {
    current = current.expression;
  }
  return current;
}
