import type ts from "typescript";
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

function containerWord(name: string): Container | null {
  const match = CONTAINER_SUFFIX.exec(name);
  if (!match) return null;
  const word = match[1] ?? match[2];
  return (word.charAt(0) + word.slice(1).toLowerCase()) as Container;
}

/**
 * Array-like: an array, a tuple, or anything indexed by number with a `length` (`NodeList`, `Uint8Array`,
 * `ArrayLike<T>`). A string has both, but is not a list.
 */
function isArrayLike(checker: ts.TypeChecker, type: ts.Type): boolean {
  if (checker.isArrayLikeType(type)) return true;
  if (checker.isTypeAssignableTo(type, checker.getStringType())) return false;
  return type.getNumberIndexType() !== undefined && type.getProperty("length") !== undefined;
}

/**
 * Whether the type, or one of its supertypes, is a library type with one of these names, or a class or interface named
 * for the container (`LinkedList`, `HashMap`). A type alias does not count: `type AccountMap = Record<string, Account>` is
 * still a plain object.
 */
function isNamedContainer(checker: ts.TypeChecker, type: ts.Type, word: Container, seen = new Set<ts.Symbol>()): boolean {
  const owner = classOrInterfaceOf(checker, type);
  if (!owner || seen.has(owner.symbol)) return false;
  seen.add(owner.symbol);
  const name = owner.symbol.getName();
  if (name.endsWith(word) || (word === "Map" || word === "Set" ? LIBRARY_CONTAINERS[word].includes(name) : false)) return true;
  return directSupertypes(checker, owner.symbol).some((base) => isNamedContainer(checker, base, word, seen));
}

function isContainer(checker: ts.TypeChecker, type: ts.Type, word: Container): boolean {
  if (word === "List" || word === "Array") return isArrayLike(checker, type) || isNamedContainer(checker, type, word);
  return isNamedContainer(checker, type, word);
}

/** The type to judge, or `null` when there is nothing to judge: `any`, `unknown`, an unconstrained type parameter, or a function (named for what it does, NAM-16). */
function judgedType(services: TypeServices, node: Node): ts.Type | null {
  const type = nonNullableTypeAt(services, node);
  const isFunction = type.getCallSignatures().length > 0;
  return isFunction || type.isTypeParameter() || isTopType(services.checker, type) ? null : type;
}

/** The identifiers a pattern binds: `a`, `{ a, b: c }`, `[d, ...e]`, `f = 1`. */
function boundIdentifiers(pattern: Node | null | undefined): TSESTree.Identifier[] {
  if (!pattern) return [];
  switch (pattern.type) {
    case "Identifier":
      return [pattern];
    case "ObjectPattern":
      return pattern.properties.flatMap((property) => boundIdentifiers(property.type === "Property" ? property.value : property));
    case "ArrayPattern":
      return pattern.elements.flatMap((element) => boundIdentifiers(element));
    case "RestElement":
      return boundIdentifiers(pattern.argument);
    case "AssignmentPattern":
      return boundIdentifiers(pattern.left);
    case "TSParameterProperty":
      return boundIdentifiers(pattern.parameter);
    default:
      return [];
  }
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

    const check = (identifier: Node): void => {
      if (identifier.type !== "Identifier") return;
      const word = containerWord(identifier.name);
      if (!word) return;
      const type = judgedType(services, identifier);
      if (!type || unionMembers(type).every((member) => isContainer(services.checker, member, word))) return;
      context.report({
        node: identifier as never,
        messageId: "falseContainer",
        data: { name: identifier.name, word, type: services.checker.typeToString(type) },
      });
    };
    const checkFunction = (node: unknown): void => {
      for (const param of asTs<TSESTree.FunctionLike>(node).params) boundIdentifiers(param).forEach(check);
    };

    return {
      VariableDeclarator(node) {
        boundIdentifiers(asTs<TSESTree.VariableDeclarator>(node).id).forEach(check);
      },
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
      CatchClause(node) {
        boundIdentifiers(asTs<TSESTree.CatchClause>(node).param).forEach(check);
      },
      PropertyDefinition(node) {
        const property = asTs<TSESTree.PropertyDefinition>(node);
        if (!property.computed) check(property.key);
      },
    };
  },
});
