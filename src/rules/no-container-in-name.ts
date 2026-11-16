import type ts from "typescript";
import type { Rule } from "eslint";
import { defineRule } from "../lib/define-rule.ts";
import { asTs, type Node, type TSESTree } from "../lib/ast.ts";
import { classOrInterfaceOf, directSupertypes, isTopType, nonNullableTypeAt, unionMembers, type TypeServices, typeServices } from "../lib/types.ts";

type Container = "List" | "Array" | "Map" | "Set";

/** `accountList`, `idMap`, `SEEN_SET`: the container word as the last camel-case or snake-case word of the name. */
const CONTAINER_SUFFIX = /(?:[a-z0-9](List|Array|Map|Set)|_(LIST|ARRAY|MAP|SET))$/;

/** The library types each word may name. `WeakMap` and `WeakSet` are maps and sets too. */
const LIBRARY_CONTAINERS: Record<"Map" | "Set", string[]> = {
  Map: ["Map", "ReadonlyMap", "WeakMap"],
  Set: ["Set", "ReadonlySet", "WeakSet"],
};

type NameCheck = (identifier: Node) => void;

/** Visits every name a declaration binds, for `check` to judge: variables, parameters, `catch` parameters and class fields. */
function bindingVisitors(check: NameCheck): Rule.RuleListener {
  return {
    VariableDeclarator(node) {
      checkPattern(check, asTs<TSESTree.VariableDeclarator>(node).id);
    },
    ...functionVisitors(check),
    CatchClause: (node) => checkPattern(check, asTs<TSESTree.CatchClause>(node).param),
    PropertyDefinition: (node) => checkFieldName(check, asTs<TSESTree.PropertyDefinition>(node)),
  };
}

function functionVisitors(check: NameCheck): Rule.RuleListener {
  const checkFunction = (node: unknown): void => asTs<TSESTree.FunctionLike>(node).params.forEach((param) => checkPattern(check, param));
  return { FunctionDeclaration: checkFunction, FunctionExpression: checkFunction, ArrowFunctionExpression: checkFunction };
}

function checkPattern(check: NameCheck, pattern: Node | null | undefined): void {
  boundIdentifiers(pattern).forEach(check);
}

/** The identifiers `pattern` binds: `a`, `{ a, b: c }`, `[d, ...e]`, `f = 1`. */
function boundIdentifiers(pattern: Node | null | undefined): TSESTree.Identifier[] {
  if (!pattern) return [];
  if (pattern.type === "Identifier") return [pattern];
  if (pattern.type === "ObjectPattern") return pattern.properties.flatMap((property) => boundIdentifiers(property.type === "Property" ? property.value : property));
  if (pattern.type === "ArrayPattern") return pattern.elements.flatMap((element) => boundIdentifiers(element));
  return boundIdentifiers(wrappedPattern(pattern));
}

/** The pattern inside `pattern` when it is a rest element, a default value or a parameter property, or `null` for any other node. */
function wrappedPattern(pattern: Node): Node | null {
  if (pattern.type === "RestElement") return pattern.argument;
  if (pattern.type === "AssignmentPattern") return pattern.left;
  return pattern.type === "TSParameterProperty" ? pattern.parameter : null;
}

function checkFieldName(check: NameCheck, property: TSESTree.PropertyDefinition): void {
  if (!property.computed) check(property.key);
}

/** Reports through `context` a name that ends in a container word when its type, read through `services`, is not that container. */
function nameChecker(context: Rule.RuleContext, services: TypeServices): NameCheck {
  return (identifier) => {
    if (identifier.type !== "Identifier") return;
    const word = containerWord(identifier.name);
    const type = word ? falseContainerType(services, identifier, word) : null;
    if (word && type) context.report({ node: identifier as never, messageId: "falseContainer", data: { name: identifier.name, word, type: services.checker.typeToString(type) } });
  };
}

function containerWord(name: string): Container | null {
  const match = CONTAINER_SUFFIX.exec(name);
  if (!match) return null;
  const word = match[1] ?? match[2];
  return (word.charAt(0) + word.slice(1).toLowerCase()) as Container;
}

/** The type of `identifier`, read through `services`, when some member of it is not the container `word` names, or `null`. */
function falseContainerType(services: TypeServices, identifier: Node, word: Container): ts.Type | null {
  const type = judgedType(services, identifier);
  if (!type || unionMembers(type).every((member) => isContainer(services.checker, member, word))) return null;
  return type;
}

/**
 * The type of `node` to judge, read through `services`, or `null` when there is nothing to judge: `any`, `unknown`, an
 * unconstrained type parameter, or a function (named for what it does, NAM-16).
 */
function judgedType(services: TypeServices, node: Node): ts.Type | null {
  const type = nonNullableTypeAt(services, node);
  const isFunction = type.getCallSignatures().length > 0;
  return isFunction || type.isTypeParameter() || isTopType(services.checker, type) ? null : type;
}

function isContainer(checker: ts.TypeChecker, type: ts.Type, word: Container): boolean {
  if (word === "List" || word === "Array") return isArrayLike(checker, type) || isNamedContainer(checker, type, word);
  return isNamedContainer(checker, type, word);
}

/**
 * Whether `type` is array-like, as `checker` sees it: an array, a tuple, or anything indexed by number with a `length`
 * (`NodeList`, `Uint8Array`, `ArrayLike<T>`). A string has both, but is not a list.
 */
function isArrayLike(checker: ts.TypeChecker, type: ts.Type): boolean {
  if (checker.isArrayLikeType(type)) return true;
  if (checker.isTypeAssignableTo(type, checker.getStringType())) return false;
  return type.getNumberIndexType() !== undefined && type.getProperty("length") !== undefined;
}

/**
 * Whether `type`, or one of its supertypes as `checker` resolves them, is a library type for the container `word`, or a
 * class or interface named for it (`LinkedList`, `HashMap`). A type alias does not count: `type AccountMap = Record<string, Account>` is
 * still a plain object.
 */
function isNamedContainer(checker: ts.TypeChecker, type: ts.Type, word: Container): boolean {
  return classAndSupertypeNames(checker, type).some((name) => isContainerName(name, word));
}

/** The names of the class or interface of `type` and of all its supertypes as `checker` resolves them, each once. */
function classAndSupertypeNames(checker: ts.TypeChecker, type: ts.Type): string[] {
  const seen = new Set<ts.Symbol>();
  collectClassAndSupertypes(checker, type, seen);
  return [...seen].map((symbol) => symbol.getName());
}

function collectClassAndSupertypes(checker: ts.TypeChecker, type: ts.Type, seen: Set<ts.Symbol>): void {
  const owner = classOrInterfaceOf(checker, type);
  if (!owner || seen.has(owner.symbol)) return;
  seen.add(owner.symbol);
  for (const base of directSupertypes(checker, owner.symbol)) collectClassAndSupertypes(checker, base, seen);
}

function isContainerName(name: string, word: Container): boolean {
  return name.endsWith(word) || isLibraryContainer(name, word);
}

function isLibraryContainer(name: string, word: Container): boolean {
  return word === "Map" || word === "Set" ? LIBRARY_CONTAINERS[word].includes(name) : false;
}

export default defineRule({
  name: "no-container-in-name",
  type: "suggestion",
  description: "Do not end a name in `List`, `Array`, `Map` or `Set` unless the value is that kind of container.",
  book: {
    entry: "NAM-03",
    chapter: "4 Meaningful Names § Avoid Disinformation",
    passage: "Programmers must avoid leaving false clues that obscure the meaning of code. For example, do not refer to a grouping of accounts as an `accountList` unless it's actually a `List` .",
  },
  requiresTypeChecking: true,
  messages: {
    falseContainer: {
      problem: "`{{name}}` is named as a `{{word}}`, but its type is `{{type}}`.",
      refactor: "rename it for what the grouping is, without the container word (`accounts`, `accountGroup`, `bunchOfAccounts`), or give it the type its name promises.",
    },
  },
  create(context) {
    const services = typeServices(context);
    if (!services) return {};
    return bindingVisitors(nameChecker(context, services));
  },
});
