import type { Rule, Scope, SourceCode } from "eslint";
import { defineRule } from "../lib/define-rule.ts";
import { asTs, isFunction, isModule, type Node, type TSESTree } from "../lib/ast.ts";
import { blankLineAfter, blockOf, childOf, endOfLineAfter, insertedAfter, removeBlock } from "../lib/moves.ts";

type Statement = TSESTree.ProgramStatement;
type ClassMember = TSESTree.ClassElement;

/** The declaration a statement makes, with any `export` around it taken off. */
function unwrap(statement: Node): Node {
  if ((statement.type === "ExportNamedDeclaration" || statement.type === "ExportDefaultDeclaration") && statement.declaration) {
    return statement.declaration as Node;
  }
  return statement;
}

function declaredName(statement: Node): string | null {
  const declaration = unwrap(statement);
  if (declaration.type === "FunctionDeclaration" || declaration.type === "TSDeclareFunction" || declaration.type === "ClassDeclaration") {
    return declaration.id?.name ?? null;
  }
  return null;
}

/** Cycles in the "calls" graph are recursion; `from` reaches `to` when following calls from `from` leads to `to`. */
function reaches(edges: Map<number, Set<number>>, from: number, to: number): boolean {
  const seen = new Set<number>([from]);
  const queue = [from];
  while (queue.length > 0) {
    const current = queue.shift() as number;
    for (const next of edges.get(current) ?? []) {
      if (next === to) return true;
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}

/** The first caller of `callee` in source order, ignoring recursion and mutual recursion. */
function firstCaller(edges: Map<number, Set<number>>, callee: number): number | null {
  const callers = [...edges.entries()].filter(([caller, callees]) => caller !== callee && callees.has(callee) && !reaches(edges, callee, caller));
  return callers.length === 0 ? null : Math.min(...callers.map(([caller]) => caller));
}

function addEdge(edges: Map<number, Set<number>>, caller: number, callee: number): void {
  if (!edges.has(caller)) edges.set(caller, new Set());
  edges.get(caller)!.add(callee);
}

/** Whether the strict-mode `"use strict"` directive opens this list of statements. */
function hasUseStrict(body: readonly Node[]): boolean {
  for (const statement of body) {
    if (statement.type !== "ExpressionStatement" || statement.expression.type !== "Literal" || typeof statement.expression.value !== "string") return false;
    if (statement.expression.value === "use strict") return true;
  }
  return false;
}

function isStrict(sourceCode: SourceCode, node: Node): boolean {
  if (isModule(sourceCode)) return true;
  for (let current: Node | undefined = node; current; current = current.parent) {
    if (current.type === "ClassBody" || (current.type === "Program" && hasUseStrict(current.body))) return true;
    if (isFunction(current) && current.body.type === "BlockStatement" && hasUseStrict(current.body.body)) return true;
  }
  return false;
}

/** A statement in a list, and whether a reference inside it is a call from a function: a declaration or a `const f = () => …`. */
function isCallFromFunction(sibling: Node, reference: Node): boolean {
  const declaration = unwrap(sibling);
  if (declaration.type === "FunctionDeclaration") return true;
  if (declaration.type !== "VariableDeclaration") return false;
  for (let current: Node | undefined = reference; current && current !== declaration; current = current.parent) {
    if (isFunction(current) && current.parent?.type === "VariableDeclarator" && current.parent.parent === declaration) return true;
  }
  return false;
}

interface ListGraph {
  edges: Map<number, Set<number>>;
  variables: Map<number, Scope.Variable>;
}

/** Who calls whom among the functions declared directly in a list of statements. */
function listGraph(sourceCode: SourceCode, statements: readonly Node[], container: Node): ListGraph {
  const edges = new Map<number, Set<number>>();
  const variables = new Map<number, Scope.Variable>();
  statements.forEach((statement, callee) => {
    const declaration = unwrap(statement);
    if (declaration.type !== "FunctionDeclaration" && declaration.type !== "VariableDeclaration") return;
    for (const variable of sourceCode.getDeclaredVariables(declaration as never)) {
      if (declaration.type === "FunctionDeclaration") variables.set(callee, variable);
      for (const reference of variable.references) {
        const sibling = childOf(asTs(reference.identifier), container);
        const caller = sibling ? statements.indexOf(sibling as Statement) : -1;
        if (caller !== -1 && caller !== callee && isCallFromFunction(statements[caller], asTs(reference.identifier))) addEdge(edges, caller, callee);
      }
    }
  });
  return { edges, variables };
}

/** The overload signatures right above an implementation, which move with it. */
function overloadStart(statements: readonly Node[], index: number, name: string): number {
  let start = index;
  while (start > 0 && unwrap(statements[start - 1]).type === "TSDeclareFunction" && declaredName(statements[start - 1]) === name) start--;
  return start;
}

function callerName(statement: Node): string {
  const declaration = unwrap(statement);
  if (declaration.type === "VariableDeclaration") {
    const declarator = declaration.declarations.find((d) => isFunction(d.init) && d.id.type === "Identifier");
    if (declarator?.id.type === "Identifier") return declarator.id.name;
  }
  return declaredName(statement) ?? "(anonymous)";
}

interface Move {
  statements: readonly Node[];
  container: Node;
  start: number;
  index: number;
  caller: number;
  variable: Scope.Variable | undefined;
}

/** Whether the catalog's conditions for the move hold: strict code, directly in a body, no duplicate name, no decorator. */
function canMove(sourceCode: SourceCode, move: Move): boolean {
  const { statements, container, start, index, variable } = move;
  const inBody = container.type === "Program" || (container.type === "BlockStatement" && isFunction(container.parent));
  if (!inBody || !isStrict(sourceCode, container)) return false;
  const group = new Set(statements.slice(start, index + 1).map(unwrap));
  const name = declaredName(statements[index]);
  if (variable && variable.defs.some((def) => !group.has(asTs(def.node)))) return false;
  if (statements.some((statement) => !group.has(unwrap(statement)) && declaredName(statement) === name)) return false;
  const decorated = [...group].some((node) => ((node as { decorators?: unknown[] }).decorators ?? []).length > 0);
  return !decorated;
}

function moveFix(sourceCode: SourceCode, move: Move): Rule.ReportFixer | null {
  if (!canMove(sourceCode, move)) return null;
  const { statements, start, index, caller } = move;
  const block = blockOf(sourceCode, statements[start], statements[index]);
  const anchor = statements[caller];
  const insertAt = endOfLineAfter(sourceCode, anchor);
  if (!block || insertAt === null) return null;
  const previous = sourceCode.getLastToken(anchor as never)!;
  const text = insertedAfter(sourceCode, previous, block, blankLineAfter(sourceCode, block));
  return (fixer) => [...removeBlock(fixer, sourceCode, block), fixer.insertTextAfterRange([insertAt, insertAt], text)];
}

function memberName(member: ClassMember): string | null {
  if (member.type === "StaticBlock") return "static {}";
  if (member.type === "TSIndexSignature" || member.computed) return null;
  if (member.key.type === "Identifier") return member.key.name;
  if (member.key.type === "PrivateIdentifier") return `#${member.key.name}`;
  return null;
}

/** The method a `this.x`, `this.#x` or `ClassName.x` inside a class member names: its name and whether it is static. */
function methodReference(expression: TSESTree.MemberExpression, member: ClassMember): { name: string; isStatic: boolean } | null {
  if (expression.computed) return null;
  const name = expression.property.type === "PrivateIdentifier" ? `#${expression.property.name}` : expression.property.type === "Identifier" ? expression.property.name : null;
  if (!name) return null;
  if (expression.object.type === "ThisExpression") return { name, isStatic: member.type === "StaticBlock" || member.static };
  return { name, isStatic: true };
}

/** The class member that `expression` is in, when `this` there (or the class's name) means this class. */
function enclosingMember(expression: TSESTree.MemberExpression): { body: TSESTree.ClassBody; member: ClassMember } | null {
  const viaName = expression.object.type === "Identifier" ? expression.object.name : null;
  let current: Node = expression;
  while (current.parent) {
    const parent: Node = current.parent;
    if (parent.type === "ClassBody") {
      const owner = parent.parent as TSESTree.ClassDeclaration | TSESTree.ClassExpression;
      if (viaName === null || owner.id?.name === viaName) return { body: parent, member: current as ClassMember };
    }
    const rebindsThis = (current.type === "FunctionExpression" || current.type === "FunctionDeclaration") && parent.type !== "MethodDefinition" && parent.type !== "TSAbstractMethodDefinition";
    if (viaName === null && rebindsThis) return null;
    current = parent;
  }
  return null;
}

function isMethodImplementation(member: ClassMember): member is TSESTree.MethodDefinition {
  return member.type === "MethodDefinition" && member.kind === "method" && member.value.type === "FunctionExpression";
}

function checkClass(context: Rule.RuleContext, body: TSESTree.ClassBody, references: TSESTree.MemberExpression[]): void {
  const members = body.body;
  const edges = new Map<number, Set<number>>();
  const methods = new Map<string, number>();
  members.forEach((member, index) => {
    const name = memberName(member);
    if (name && isMethodImplementation(member)) methods.set(`${member.static}:${name}`, index);
  });
  for (const expression of references) {
    const found = enclosingMember(expression);
    const reference = found?.body === body ? methodReference(expression, found.member) : null;
    const callee = reference ? methods.get(`${reference.isStatic}:${reference.name}`) : undefined;
    if (found && callee !== undefined) addEdge(edges, members.indexOf(found.member), callee);
  }
  for (const [key, index] of methods) {
    const caller = firstCaller(edges, index);
    if (caller === null || caller < index) continue;
    context.report({
      node: (members[index] as TSESTree.MethodDefinition).key as never,
      messageId: "methodAboveCaller",
      data: { name: key.slice(key.indexOf(":") + 1), caller: memberName(members[caller]) ?? "constructor" },
    });
  }
}

function checkList(context: Rule.RuleContext, statements: readonly Node[], container: Node): void {
  const sourceCode = context.sourceCode;
  const { edges, variables } = listGraph(sourceCode, statements, container);
  statements.forEach((statement, index) => {
    const declaration = unwrap(statement);
    if (declaration.type !== "FunctionDeclaration" || !declaration.id) return;
    const caller = firstCaller(edges, index);
    if (caller === null || caller < index) return;
    const name = declaration.id.name;
    const move: Move = { statements, container, start: overloadStart(statements, index, name), index, caller, variable: variables.get(index) };
    context.report({
      node: declaration.id as never,
      messageId: "functionAboveCaller",
      data: { name, caller: callerName(statements[caller]) },
      fix: moveFix(sourceCode, move),
    });
  });
}

export default defineRule({
  name: "stepdown-order",
  type: "suggestion",
  description: "Declare a function below the first function that calls it, so the code reads top to bottom (the Stepdown Rule).",
  book: {
    entry: "FMT-04",
    chapter: "10 One Thing § 4. Bouncing Around",
    passage: "If function A calls B and C, then their order in the source file should be A, B, C.",
  },
  fixable: "code",
  messages: {
    functionAboveCaller: {
      problem: "Function `{{name}}` is declared above `{{caller}}`, the first function that calls it, so a reader has to scroll up to find it.",
      refactor: "move `{{name}}` to just below `{{caller}}`, so each function is followed by the functions it calls.",
    },
    methodAboveCaller: {
      problem: "Method `{{name}}` is declared above `{{caller}}`, the first member that calls it, so a reader has to scroll up to find it.",
      refactor: "move `{{name}}` to just below `{{caller}}`, so each method is followed by the methods it calls.",
    },
  },
  create(context) {
    const references: TSESTree.MemberExpression[] = [];
    const classes: TSESTree.ClassBody[] = [];
    return {
      Program(node) {
        checkList(context, asTs<TSESTree.Program>(node).body, asTs(node));
      },
      BlockStatement(node) {
        checkList(context, asTs<TSESTree.BlockStatement>(node).body, asTs(node));
      },
      StaticBlock(node) {
        checkList(context, asTs<TSESTree.StaticBlock>(node).body, asTs(node));
      },
      SwitchCase(node) {
        checkList(context, asTs<TSESTree.SwitchCase>(node).consequent, asTs(node));
      },
      TSModuleBlock(node: unknown) {
        checkList(context, asTs<TSESTree.TSModuleBlock>(node).body, asTs(node));
      },
      ClassBody(node) {
        classes.push(asTs(node));
      },
      MemberExpression(node) {
        const expression = asTs<TSESTree.MemberExpression>(node);
        if (expression.object.type === "ThisExpression" || expression.object.type === "Identifier") references.push(expression);
      },
      "Program:exit"() {
        for (const body of classes) checkClass(context, body, references);
      },
    } as Rule.RuleListener;
  },
});
