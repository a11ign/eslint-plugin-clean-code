/**
 * Helpers for the type-aware rules (`recommended-type-checked`, ESLint only). They read the TypeScript program that
 * typescript-eslint's `projectService` builds, through `context.sourceCode.parserServices`.
 *
 * `typescript` is imported for its types only. The build bundles every dev dependency, and the consumer's copy comes
 * through typescript-eslint, so a runtime import would ship a second compiler inside this plugin. Everything below uses
 * the methods of the checker, the program and the nodes instead of `ts.SyntaxKind` or `ts.SymbolFlags`.
 */
import type { Rule } from "eslint";
import type ts from "typescript";
import type { Node } from "./ast.ts";

export interface TypeServices {
  program: ts.Program;
  checker: ts.TypeChecker;
  /** The TypeScript node for an ESTree node of the file being linted. */
  tsNode: (node: Node) => ts.Node;
}

interface ParserServicesShape {
  program?: ts.Program | null;
  esTreeNodeToTSNodeMap?: { get: (node: Node) => ts.Node };
}

/** The program and checker of the file `context` lints, or `null` when the file was parsed without type information (then a rule reports nothing). */
export function typeServices(context: Rule.RuleContext): TypeServices | null {
  const services = (context.sourceCode as { parserServices?: ParserServicesShape }).parserServices;
  const program = services?.program;
  const map = services?.esTreeNodeToTSNodeMap;
  if (!program || !map) return null;
  return { program, checker: program.getTypeChecker(), tsNode: (node) => map.get(node) };
}

/** The members of the union `type`, or `type` itself. */
export function unionMembers(type: ts.Type): ts.Type[] {
  return type.isUnion() ? type.types : [type];
}

/** The class or interface `type` is an instance of (`Foo` for `Foo<number>`), as `checker` declares it, or `null`. */
export function classOrInterfaceOf(checker: ts.TypeChecker, type: ts.Type): { symbol: ts.Symbol; declared: ts.InterfaceType } | null {
  const symbol = type.getSymbol();
  if (!symbol) return null;
  const declared = checker.getDeclaredTypeOfSymbol(symbol);
  return declared.isClassOrInterface() ? { symbol, declared } : null;
}

/**
 * Whether `symbol` is a class declared in the project (see `isProjectDeclaration`), checked with the checker and program of
 * `services`. Every declaration must be, so a project interface merged into a library class does not make it a project class.
 */
export function isProjectClass(services: TypeServices, symbol: ts.Symbol): boolean {
  if (!services.checker.getDeclaredTypeOfSymbol(symbol).isClass()) return false;
  const declarations = symbol.getDeclarations() ?? [];
  return declarations.length > 0 && declarations.every((declaration) => isProjectDeclaration(services.program, declaration));
}

/** Whether `declaration` is the project's own code in `program`: not in a default library file (`lib.*.d.ts`) and not under `node_modules`. */
export function isProjectDeclaration(program: ts.Program, declaration: ts.Node): boolean {
  const file = declaration.getSourceFile();
  if (program.isSourceFileDefaultLibrary(file) || program.isSourceFileFromExternalLibrary(file)) return false;
  return !/[\\/]node_modules[\\/]/.test(file.fileName);
}

/** Whether `declaration` is a method or accessor with a body: a concrete function, as opposed to an abstract method or an overload signature. */
export function hasBody(declaration: ts.Node): boolean {
  return isFunctionLikeDeclaration(declaration) && (declaration as { body?: unknown }).body !== undefined;
}

/** Whether `declaration` is a method or accessor: something with a parameter list (fields and parameter properties have none). */
export function isFunctionLikeDeclaration(declaration: ts.Node): boolean {
  return "parameters" in declaration && Array.isArray((declaration as { parameters?: unknown }).parameters);
}

/** Whether `declaration` is a field or parameter property that is `private`, `protected` or `#private`. */
export function isNonPublicState(declaration: ts.Node): boolean {
  if (isFunctionLikeDeclaration(declaration)) return false;
  const name = (declaration as { name?: ts.Node }).name;
  if (name?.getText().startsWith("#")) return true;
  return hasModifier(declaration, "private") || hasModifier(declaration, "protected");
}

/** Whether `declaration` carries the modifier `keyword` (`abstract`, `private`, `static` and so on). */
export function hasModifier(declaration: ts.Node, keyword: string): boolean {
  return modifierTexts(declaration).includes(keyword);
}

function modifierTexts(declaration: ts.Node): string[] {
  const modifiers = (declaration as { modifiers?: readonly ts.Node[] }).modifiers ?? [];
  return modifiers.map((modifier) => modifier.getText());
}

/** Whether `symbol` extends or implements `ancestor`, directly or through other types, as `checker` resolves them. */
export function inheritsFrom(checker: ts.TypeChecker, symbol: ts.Symbol, ancestor: ts.Symbol): boolean {
  const seen = new Set<ts.Symbol>();
  const reaches = (current: ts.Symbol): boolean => {
    if (seen.has(current)) return false;
    seen.add(current);
    return directSupertypes(checker, current).some((base) => {
      const baseSymbol = base.getSymbol();
      return baseSymbol !== undefined && (baseSymbol === ancestor || reaches(baseSymbol));
    });
  };
  return reaches(symbol);
}

/** The direct supertypes of the class `symbol`, as `checker` resolves them: what it `extends` and `implements` (an interface: what it `extends`). */
export function directSupertypes(checker: ts.TypeChecker, symbol: ts.Symbol): ts.Type[] {
  const declared = checker.getDeclaredTypeOfSymbol(symbol);
  const bases: ts.Type[] = declared.isClassOrInterface() ? [...checker.getBaseTypes(declared)] : [];
  for (const declaration of symbol.getDeclarations() ?? []) bases.push(...heritageTypes(checker, declaration));
  return bases;
}

/** The types the `extends` and `implements` clauses of `declaration` name, resolved by `checker`, in source order. */
function heritageTypes(checker: ts.TypeChecker, declaration: ts.Declaration): ts.Type[] {
  const clauses = (declaration as { heritageClauses?: readonly ts.HeritageClause[] }).heritageClauses ?? [];
  return clauses.flatMap((clause) => clause.types.map((heritage) => checker.getTypeAtLocation(heritage)));
}

/**
 * The TypeScript type of the ESTree `node`, read through `services`, with `null` and `undefined` removed. A type parameter
 * is replaced by its constraint when it has one. `any` and `unknown` are returned as they are (`NonNullable<unknown>` would
 * be `{}`), and so is an unconstrained type parameter.
 */
export function nonNullableTypeAt(services: TypeServices, node: Node): ts.Type {
  const { checker } = services;
  let type = checker.getTypeAtLocation(services.tsNode(node));
  if (type.isTypeParameter()) type = checker.getBaseConstraintOfType(type) ?? type;
  if (type.isTypeParameter() || isTopType(checker, type)) return type;
  return checker.getNonNullableType(type);
}

/** Whether `type` is `any` or `unknown`, the only types `checker` finds `unknown` assignable to. They carry no information to report on. */
export function isTopType(checker: ts.TypeChecker, type: ts.Type): boolean {
  return checker.isTypeAssignableTo(checker.getUnknownType(), type);
}
