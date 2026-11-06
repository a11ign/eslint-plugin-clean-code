import type { Rule, Scope, SourceCode } from "eslint";
import { defineRule } from "../lib/define-rule.ts";
import { asTs, hasUseStrictDirective, isFunction, isModule, type Node, type Token, type TSESTree } from "../lib/ast.ts";
import { blankLineAfter, blockOf, childOf, crossesDirective, endOfLineAfter, insertedAfter, mergeAdjacent, removeBlock, type Block } from "../lib/moves.ts";

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

/** The functions that call `callee`, leaving out recursion and mutual recursion. */
function callersOf(edges: Map<number, Set<number>>, callee: number): number[] {
  return [...edges.keys()].filter((caller) => caller !== callee && edges.get(caller)!.has(callee) && !reaches(edges, callee, caller));
}

/** The first of `callers` by `position` (source order by default). */
function earliest(callers: number[], position: (index: number) => number = (index) => index): number | null {
  if (callers.length === 0) return null;
  return callers.reduce((first, caller) => (position(caller) < position(first) ? caller : first));
}

/** The first caller of `callee` in source order, ignoring recursion and mutual recursion. */
function firstCaller(edges: Map<number, Set<number>>, callee: number): number | null {
  return earliest(callersOf(edges, callee));
}

function addEdge(edges: Map<number, Set<number>>, caller: number, callee: number): void {
  if (!edges.has(caller)) edges.set(caller, new Set());
  edges.get(caller)!.add(callee);
}

function isStrict(sourceCode: SourceCode, node: Node): boolean {
  if (isModule(sourceCode)) return true;
  for (let current: Node | undefined = node; current; current = current.parent) {
    if (current.type === "ClassBody" || (current.type === "Program" && hasUseStrictDirective(current.body))) return true;
    if (isFunction(current) && current.body.type === "BlockStatement" && hasUseStrictDirective(current.body.body)) return true;
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

/** A function declaration with the overload signatures above it (`statements[start..index]`), which move as one. */
interface Unit {
  start: number;
  index: number;
}

interface List {
  sourceCode: SourceCode;
  statements: readonly Node[];
  container: Node;
  graph: ListGraph;
}

/** Whether the catalog's conditions for the move hold: strict code, directly in a body, no duplicate name, no decorator. */
function canMove(list: List, unit: Unit): boolean {
  const { sourceCode, statements, container, graph } = list;
  const inBody = container.type === "Program" || (container.type === "BlockStatement" && isFunction(container.parent));
  if (!inBody || !isStrict(sourceCode, container)) return false;
  const group = new Set(statements.slice(unit.start, unit.index + 1).map(unwrap));
  const name = declaredName(statements[unit.index]);
  const variable = graph.variables.get(unit.index);
  if (variable && variable.defs.some((def) => !group.has(asTs(def.node)))) return false;
  if (statements.some((statement) => !group.has(unwrap(statement)) && declaredName(statement) === name)) return false;
  return ![...group].some((node) => ((node as { decorators?: unknown[] }).decorators ?? []).length > 0);
}

/** The block a function would move as, or `null` when it cannot move: a catalog condition fails, it shares a line, or it holds a region directive. */
function movableBlock(list: List, unit: Unit): Block | null {
  if (unwrap(list.statements[unit.index]).type !== "FunctionDeclaration" || !canMove(list, unit)) return null;
  const block = blockOf(list.sourceCode, list.statements[unit.start], list.statements[unit.index]);
  return block && !crossesDirective(list.sourceCode, [block], block.range[0]) ? block : null;
}

/**
 * The order the list settles in when each misplaced movable function moves to just after its first caller, repeated
 * until none is misplaced: what `--fix` passes would reach one move at a time, computed at once so one pass is enough.
 * `null` when it does not settle.
 */
function settle(edges: Map<number, Set<number>>, units: number[], movable: Set<number>): { order: number[]; moved: Set<number> } | null {
  const order = [...units];
  const moved = new Set<number>();
  const callers = new Map([...movable].map((unit) => [unit, callersOf(edges, unit)]));
  for (let step = 0; step <= order.length * order.length; step++) {
    const position = (index: number) => order.indexOf(index);
    const misplaced = order.find((unit) => {
      const caller = movable.has(unit) ? earliest(callers.get(unit)!, position) : null;
      return caller !== null && position(caller) > position(unit);
    });
    if (misplaced === undefined) return { order, moved };
    const caller = earliest(callers.get(misplaced)!, position) as number;
    order.splice(position(misplaced), 1);
    order.splice(position(caller) + 1, 0, misplaced);
    moved.add(misplaced);
  }
  return null;
}

/** The moved functions after each statement that stays, in their new order. */
function groupsAfterAnchors(order: number[], moved: Set<number>): Map<number, number[]> | null {
  const groups = new Map<number, number[]>();
  let anchor: number | null = null;
  for (const unit of order) {
    if (!moved.has(unit)) {
      anchor = unit;
      groups.set(unit, []);
    } else if (anchor === null) {
      return null;
    } else {
      groups.get(anchor)!.push(unit);
    }
  }
  return groups;
}

/** The insertions after each statement that stays, or `null` when one cannot be made safely. */
function insertions(list: List, groups: Map<number, number[]>, blocks: Map<number, Block>): Array<{ at: number; text: string }> | null {
  const { sourceCode, statements } = list;
  const result: Array<{ at: number; text: string }> = [];
  for (const [anchor, group] of groups) {
    if (group.length === 0) continue;
    const at = endOfLineAfter(sourceCode, statements[anchor]);
    const groupBlocks = group.map((unit) => blocks.get(unit)!);
    if (at === null || crossesDirective(sourceCode, groupBlocks, at)) return null;
    let previous = sourceCode.getLastToken(statements[anchor] as never) as Token;
    let text = "";
    for (const block of groupBlocks) {
      text += insertedAfter(sourceCode, previous, block, blankLineAfter(sourceCode, block));
      previous = block.lastToken;
    }
    result.push({ at, text });
  }
  return result;
}

/** One fix for the whole list: every function that has to move goes below its first caller, so one pass settles the list. */
function listFix(list: List, units: Unit[]): Rule.ReportFixer | null {
  const blocks = new Map<number, Block>();
  for (const unit of units) {
    const block = movableBlock(list, unit);
    if (block) blocks.set(unit.index, block);
  }
  const settled = settle(list.graph.edges, units.map((unit) => unit.index), new Set(blocks.keys()));
  const groups = settled && groupsAfterAnchors(settled.order, settled.moved);
  const inserts = groups && insertions(list, groups, blocks);
  if (!settled || !inserts) return null;
  const removed = [...settled.moved].map((unit) => blocks.get(unit)!).sort((a, b) => a.range[0] - b.range[0]);
  const { sourceCode } = list;
  return (fixer) => [
    ...mergeAdjacent(sourceCode, removed).flatMap((run) => removeBlock(fixer, sourceCode, run)),
    ...inserts.map(({ at, text }) => fixer.insertTextAfterRange([at, at], text)),
  ];
}

/** The list's statements as units: overload signatures belong to the implementation after them. */
function unitsOf(statements: readonly Node[]): Unit[] {
  const units: Unit[] = [];
  statements.forEach((statement, index) => {
    const declaration = unwrap(statement);
    const name = declaredName(statement);
    if (declaration.type === "FunctionDeclaration" && name) {
      const start = overloadStart(statements, index, name);
      units.splice(units.length - (index - start), index - start);
      units.push({ start, index });
    } else {
      units.push({ start: index, index });
    }
  });
  return units;
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
  const list: List = { sourceCode, statements, container, graph: listGraph(sourceCode, statements, container) };
  const units = unitsOf(statements);
  const reported = units.filter((unit) => {
    const caller = unwrap(statements[unit.index]).type === "FunctionDeclaration" ? firstCaller(list.graph.edges, unit.index) : null;
    return caller !== null && caller > unit.index;
  });
  if (reported.length === 0) return;
  const fix = listFix(list, units);
  for (const unit of reported) {
    const declaration = unwrap(statements[unit.index]) as TSESTree.FunctionDeclaration;
    const caller = firstCaller(list.graph.edges, unit.index) as number;
    context.report({
      node: declaration.id as never,
      messageId: "functionAboveCaller",
      data: { name: declaration.id!.name, caller: callerName(statements[caller]) },
      fix: fix && movableBlock(list, unit) ? fix : null,
    });
  }
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
