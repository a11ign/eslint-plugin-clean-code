import type { Rule, Scope, SourceCode } from "eslint";
import { defineRule } from "../lib/define-rule.ts";
import { asTs, hasUseStrictDirective, isFunction, isModule, type Node, type Token, type TSESTree } from "../lib/ast.ts";
import { blockOf, childOf, crossesDirective, endOfLineAfter, insertedAfter, mergeAdjacent, removeBlock, type Block } from "../lib/moves.ts";

type Statement = TSESTree.ProgramStatement;
type ClassMember = TSESTree.ClassElement;

interface ListGraph {
  edges: Map<number, Set<number>>;
  variables: Map<number, Scope.Variable>;
}

/** A function declaration with the overload signatures above it (`statements[start..index]`), which move as one. */
interface Unit {
  start: number;
  index: number;
}

/** A list of statements, the node that holds it, and its source. */
interface Siblings {
  sourceCode: SourceCode;
  statements: readonly Node[];
  container: Node;
}

interface List extends Siblings {
  graph: ListGraph;
}

function checkClass(context: Rule.RuleContext, body: TSESTree.ClassBody, references: TSESTree.MemberExpression[]): void {
  const methods = methodIndexes(body.body);
  const edges = methodCalls(body, references, methods);
  for (const [key, index] of methods) {
    const caller = firstCaller(edges, index);
    if (caller !== null && caller > index) reportMethodAboveCaller(context, body.body, { key, index, caller });
  }
}

/** The method implementations among a class's `members`, keyed by `static:name`, with their index among them. */
function methodIndexes(members: ClassMember[]): Map<string, number> {
  const methods = new Map<string, number>();
  members.forEach((member, index) => {
    const name = memberName(member);
    if (name && isMethodImplementation(member)) methods.set(`${member.static}:${name}`, index);
  });
  return methods;
}

/** Which members of `body` call which of its `methods`, through the `this.x` and `ClassName.x` `references` inside them, as member indexes. */
function methodCalls(body: TSESTree.ClassBody, references: TSESTree.MemberExpression[], methods: Map<string, number>): Map<number, Set<number>> {
  const edges = new Map<number, Set<number>>();
  for (const expression of references) {
    const call = methodCall(body, expression, methods);
    if (call) addEdge(edges, call.caller, call.callee);
  }
  return edges;
}

/** The member of `body` that `expression` is in and the method of `methods` it names, as indexes among the class's members. */
function methodCall(body: TSESTree.ClassBody, expression: TSESTree.MemberExpression, methods: Map<string, number>): { caller: number; callee: number } | null {
  const found = enclosingMember(expression);
  const reference = found?.body === body ? methodReference(expression, found.member) : null;
  const callee = reference ? methods.get(`${reference.isStatic}:${reference.name}`) : undefined;
  return found && callee !== undefined ? { caller: body.body.indexOf(found.member), callee } : null;
}

/** A method declared above its first caller: its `static:name` key, and its and its caller's indexes among the members. */
interface MisplacedMethod {
  key: string;
  index: number;
  caller: number;
}

function reportMethodAboveCaller(context: Rule.RuleContext, members: ClassMember[], { key, index, caller }: MisplacedMethod): void {
  context.report({
    node: (members[index] as TSESTree.MethodDefinition).key as never,
    messageId: "methodAboveCaller",
    data: { name: key.slice(key.indexOf(":") + 1), caller: memberName(members[caller]) ?? "constructor" },
  });
}

function isMethodImplementation(member: ClassMember): member is TSESTree.MethodDefinition {
  return member.type === "MethodDefinition" && member.kind === "method" && member.value.type === "FunctionExpression";
}

/** The class member that `expression` is in, when `this` there (or the class's name) means this class. */
function enclosingMember(expression: TSESTree.MemberExpression): { body: TSESTree.ClassBody; member: ClassMember } | null {
  const viaName = expression.object.type === "Identifier" ? expression.object.name : null;
  for (const [current, parent] of withParents(expression)) {
    if (isBodyOfClass(parent, viaName)) return { body: parent, member: current as ClassMember };
    if (viaName === null && rebindsThis(current, parent)) return null;
  }
  return null;
}

/** Each node from `node` up to the root, paired with its parent. */
function* withParents(node: Node): Generator<[Node, Node]> {
  let current = node;
  while (current.parent) {
    yield [current, current.parent];
    current = current.parent;
  }
}

/** Whether `node` is the body of the class that `this` means, or, through its name, `viaName` does. */
function isBodyOfClass(node: Node, viaName: string | null): node is TSESTree.ClassBody {
  if (node.type !== "ClassBody") return false;
  const owner = node.parent as TSESTree.ClassDeclaration | TSESTree.ClassExpression;
  return viaName === null || owner.id?.name === viaName;
}

/** Whether `node` is a `function` that its `parent` does not make a method, so `this` inside it is not the class's instance. */
function rebindsThis(node: Node, parent: Node): boolean {
  const isPlainFunction = node.type === "FunctionExpression" || node.type === "FunctionDeclaration";
  return isPlainFunction && parent.type !== "MethodDefinition" && parent.type !== "TSAbstractMethodDefinition";
}

/** The method that `expression`, a `this.x`, `this.#x` or `ClassName.x` inside `member`, names: its name and whether it is static. */
function methodReference(expression: TSESTree.MemberExpression, member: ClassMember): { name: string; isStatic: boolean } | null {
  if (expression.computed) return null;
  const name = expression.property.type === "PrivateIdentifier" ? `#${expression.property.name}` : expression.property.type === "Identifier" ? expression.property.name : null;
  if (!name) return null;
  if (expression.object.type === "ThisExpression") return { name, isStatic: member.type === "StaticBlock" || member.static };
  return { name, isStatic: true };
}

function memberName(member: ClassMember): string | null {
  if (member.type === "StaticBlock") return "static {}";
  if (member.type === "TSIndexSignature" || member.computed) return null;
  if (member.key.type === "Identifier") return member.key.name;
  if (member.key.type === "PrivateIdentifier") return `#${member.key.name}`;
  return null;
}

function addEdge(edges: Map<number, Set<number>>, caller: number, callee: number): void {
  if (!edges.has(caller)) edges.set(caller, new Set());
  edges.get(caller)!.add(callee);
}

/** The first caller of `callee` in the call graph `edges`, in source order, ignoring recursion and mutual recursion. */
function firstCaller(edges: Map<number, Set<number>>, callee: number): number | null {
  return earliest(callersOf(edges, callee));
}

/** The functions that call `callee` in `edges`, leaving out recursion and mutual recursion. */
function callersOf(edges: Map<number, Set<number>>, callee: number): number[] {
  return [...edges.keys()].filter((caller) => caller !== callee && edges.get(caller)!.has(callee) && !reaches(edges, callee, caller));
}

/** Cycles in the "calls" graph `edges` are recursion; `from` reaches `to` when following calls from `from` leads to `to`. */
function reaches(edges: Map<number, Set<number>>, from: number, to: number): boolean {
  return reachableFrom(edges, from).has(to);
}

/** Every function that following the calls in `edges` from `from` leads to. */
function reachableFrom(edges: Map<number, Set<number>>, from: number): Set<number> {
  const reached = new Set<number>();
  const queue = [from];
  while (queue.length > 0) {
    const fresh = [...(edges.get(queue.shift() as number) ?? [])].filter((next) => !reached.has(next));
    for (const next of fresh) {
      reached.add(next);
      queue.push(next);
    }
  }
  return reached;
}

/** The first of `callers` by `position` (source order by default). */
function earliest(callers: number[], position: (index: number) => number = (index) => index): number | null {
  if (callers.length === 0) return null;
  return callers.reduce((first, caller) => (position(caller) < position(first) ? caller : first));
}

function checkList(context: Rule.RuleContext, container: StatementList): void {
  const siblings: Siblings = { sourceCode: context.sourceCode, statements: statementsOf(container), container };
  const list: List = { ...siblings, graph: listGraph(siblings) };
  const units = unitsOf(siblings.statements);
  const reported = units.filter((unit) => isAboveCaller(list, unit));
  if (reported.length === 0) return;
  const fix = listFix(list, units);
  const fixOf = (unit: Unit) => (fix && movableBlock(list, unit) ? fix : null);
  for (const unit of reported) reportFunctionAboveCaller(context, list, { unit, fix: fixOf(unit) });
}

/** A node that holds a list of statements. */
type StatementList = TSESTree.Program | TSESTree.BlockStatement | TSESTree.StaticBlock | TSESTree.SwitchCase | TSESTree.TSModuleBlock;

function statementsOf(container: StatementList): readonly Node[] {
  return container.type === "SwitchCase" ? container.consequent : container.body;
}

/** Whether `unit` is a function declaration declared above its first caller in `list`. */
function isAboveCaller(list: List, unit: Unit): boolean {
  const caller = unwrap(list.statements[unit.index]).type === "FunctionDeclaration" ? firstCaller(list.graph.edges, unit.index) : null;
  return caller !== null && caller > unit.index;
}

/** A function declared above its first caller, and the list's fix when this function is one that can move. */
interface MisplacedFunction {
  unit: Unit;
  fix: Rule.ReportFixer | null;
}

function reportFunctionAboveCaller(context: Rule.RuleContext, list: List, { unit, fix }: MisplacedFunction): void {
  const declaration = unwrap(list.statements[unit.index]) as TSESTree.FunctionDeclaration;
  const caller = firstCaller(list.graph.edges, unit.index) as number;
  context.report({
    node: declaration.id as never,
    messageId: "functionAboveCaller",
    data: { name: declaration.id!.name, caller: callerName(list.statements[caller]) },
    fix,
  });
}

/** The declaration `statement` makes, with any `export` around it taken off. */
function unwrap(statement: Node): Node {
  if (!isExport(statement)) return statement;
  return (statement.declaration as Node | null) ?? statement;
}

function isExport(statement: Node): statement is TSESTree.ExportNamedDeclaration | TSESTree.ExportDefaultDeclaration {
  return statement.type === "ExportNamedDeclaration" || statement.type === "ExportDefaultDeclaration";
}

/** A list's `statements` as units: overload signatures belong to the implementation after them. */
function unitsOf(statements: readonly Node[]): Unit[] {
  const units: Unit[] = [];
  statements.forEach((_statement, index) => {
    const start = unitStart(statements, index);
    units.splice(units.length - (index - start), index - start);
    units.push({ start, index });
  });
  return units;
}

/** Where the unit ending at `index` of `statements` starts: at its first overload signature when it is a function implementation. */
function unitStart(statements: readonly Node[], index: number): number {
  const name = declaredName(statements[index]);
  return unwrap(statements[index]).type === "FunctionDeclaration" && name ? overloadStart(statements, index, name) : index;
}

function declaredName(statement: Node): string | null {
  const declaration = unwrap(statement);
  if (declaration.type === "FunctionDeclaration" || declaration.type === "TSDeclareFunction" || declaration.type === "ClassDeclaration") {
    return declaration.id?.name ?? null;
  }
  return null;
}

/** Where the overload signatures of `name` right above the implementation at `index` of `statements` start; they move with it. */
function overloadStart(statements: readonly Node[], index: number, name: string): number {
  let start = index;
  while (start > 0 && unwrap(statements[start - 1]).type === "TSDeclareFunction" && declaredName(statements[start - 1]) === name) start--;
  return start;
}

/**
 * The block `unit` of `list` would move as, or `null` when it cannot move: a catalog condition fails, it shares a line, or it
 * holds a region directive.
 */
function movableBlock(list: List, unit: Unit): Block | null {
  if (unwrap(list.statements[unit.index]).type !== "FunctionDeclaration" || !canMove(list, unit)) return null;
  const block = blockOf(list.sourceCode, list.statements[unit.start], list.statements[unit.index]);
  return block && !crossesDirective(list.sourceCode, [block], block.range[0]) ? block : null;
}

/** Whether the catalog's conditions for moving `unit` within `list` hold: strict code, directly in a body, no duplicate name, no decorator. */
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

function isStrict(sourceCode: SourceCode, node: Node): boolean {
  if (isModule(sourceCode)) return true;
  for (let current: Node | undefined = node; current; current = current.parent) {
    if (makesStrict(current)) return true;
  }
  return false;
}

/** Whether `node` makes the code inside it strict: a class body, or a program or function body with a `"use strict"` directive. */
function makesStrict(node: Node): boolean {
  if (node.type === "ClassBody") return true;
  if (node.type === "Program") return hasUseStrictDirective(node.body);
  return isFunction(node) && node.body.type === "BlockStatement" && hasUseStrictDirective(node.body.body);
}

/** One fix for the whole `list`: every one of its `units` that has to move goes below its first caller, so one pass settles the list. */
function listFix(list: List, units: Unit[]): Rule.ReportFixer | null {
  const blocks = movableBlocks(list, units);
  const settled = settle(list.graph.edges, units.map((unit) => unit.index), new Set(blocks.keys()));
  const groups = settled && groupsAfterAnchors(settled.order, settled.moved);
  const inserts = groups && insertions(list, groups, blocks);
  if (!settled || !inserts) return null;
  const removed = [...settled.moved].map((unit) => blocks.get(unit)!).sort((a, b) => a.range[0] - b.range[0]);
  return moveFix(list.sourceCode, removed, inserts);
}

/** The block each of `units` that can move would move as, by its index in `list`. */
function movableBlocks(list: List, units: Unit[]): Map<number, Block> {
  const blocks = new Map<number, Block>();
  for (const unit of units) {
    const block = movableBlock(list, unit);
    if (block) blocks.set(unit.index, block);
  }
  return blocks;
}

/** The fix that removes the `removed` blocks from `sourceCode` and makes the `inserts`. */
function moveFix(sourceCode: SourceCode, removed: Block[], inserts: Insertion[]): Rule.ReportFixer {
  return (fixer) => [
    ...mergeAdjacent(sourceCode, removed).flatMap((run) => removeBlock(fixer, sourceCode, run)),
    ...inserts.map(({ at, text }) => fixer.insertTextAfterRange([at, at], text)),
  ];
}

/**
 * The order `units` settle in when each misplaced `movable` function moves to just after its first caller in `edges`, repeated
 * until none is misplaced: what `--fix` passes would reach one move at a time, computed at once so one pass is enough.
 * `null` when it does not settle.
 */
function settle(edges: Map<number, Set<number>>, units: number[], movable: Set<number>): { order: number[]; moved: Set<number> } | null {
  const order = [...units];
  const moved = new Set<number>();
  const callers = new Map([...movable].map((unit) => [unit, callersOf(edges, unit)]));
  for (let step = 0; step <= order.length * order.length; step++) {
    const misplaced = firstMisplaced(order, callers);
    if (misplaced) moveBelowCaller(order, moved, misplaced);
    else return { order, moved };
  }
  return null;
}

/** A movable function placed above its first caller in an order, and that caller. */
interface Misplacement {
  unit: number;
  caller: number;
}

/** The first movable function in `order` that is above its first caller; `callers` holds the callers of each movable one. */
function firstMisplaced(order: number[], callers: Map<number, number[]>): Misplacement | null {
  const position = (index: number) => order.indexOf(index);
  for (const unit of order) {
    const caller = callers.has(unit) ? earliest(callers.get(unit)!, position) : null;
    if (caller !== null && position(caller) > position(unit)) return { unit, caller };
  }
  return null;
}

/** Moves `unit` to just after `caller` in `order`, and records in `moved` that it moved. */
function moveBelowCaller(order: number[], moved: Set<number>, { unit, caller }: Misplacement): void {
  order.splice(order.indexOf(unit), 1);
  order.splice(order.indexOf(caller) + 1, 0, unit);
  moved.add(unit);
}

/** The `moved` functions after each statement of `order` that stays, in their new order. */
function groupsAfterAnchors(order: number[], moved: Set<number>): Map<number, number[]> | null {
  if (order.length > 0 && moved.has(order[0])) return null;
  const groups: Array<[number, number[]]> = [];
  for (const unit of order) {
    if (moved.has(unit)) groups.at(-1)![1].push(unit);
    else groups.push([unit, []]);
  }
  return new Map(groups);
}

/** The insertions that put each of `groups`, as its `blocks`, after the statement of `list` it follows, or `null` when one cannot be made safely. */
function insertions(list: List, groups: Map<number, number[]>, blocks: Map<number, Block>): Insertion[] | null {
  const nonEmpty = [...groups].filter(([, group]) => group.length > 0);
  const result = nonEmpty.map(([anchor, group]) => insertionAfter(list.sourceCode, list.statements[anchor], group.map((unit) => blocks.get(unit)!)));
  return result.includes(null) ? null : (result as Insertion[]);
}

/** Text to insert, and the offset to insert it at. */
interface Insertion {
  at: number;
  text: string;
}

/** The insertion into `sourceCode` that puts `blocks` after the statement `anchor`, or `null` when it cannot be made safely. */
function insertionAfter(sourceCode: SourceCode, anchor: Node, blocks: Block[]): Insertion | null {
  const at = endOfLineAfter(sourceCode, anchor);
  if (at === null || crossesDirective(sourceCode, blocks, at)) return null;
  return { at, text: movedText(sourceCode, anchor, blocks) };
}

/** The moved `blocks` as one text, each laid out after the one before it in `sourceCode`, the first after `anchor`. */
function movedText(sourceCode: SourceCode, anchor: Node, blocks: Block[]): string {
  let previous = sourceCode.getLastToken(anchor as never) as Token;
  let text = "";
  for (const block of blocks) {
    text += insertedAfter(sourceCode, previous, block);
    previous = block.lastToken;
  }
  return text;
}

function callerName(statement: Node): string {
  const declaration = unwrap(statement);
  if (declaration.type === "VariableDeclaration") {
    const declarator = declaration.declarations.find((d) => isFunction(d.init) && d.id.type === "Identifier");
    if (declarator?.id.type === "Identifier") return declarator.id.name;
  }
  return declaredName(statement) ?? "(anonymous)";
}

/** Who calls whom among the functions declared directly in the list of statements `siblings`. */
function listGraph(siblings: Siblings): ListGraph {
  const graph: ListGraph = { edges: new Map(), variables: new Map() };
  siblings.statements.forEach((statement, callee) => {
    const declaration = unwrap(statement);
    if (declaration.type === "FunctionDeclaration" || declaration.type === "VariableDeclaration") addDeclaration(siblings, graph, callee);
  });
  return graph;
}

/** Adds what the declaration at `callee` in `siblings` declares to `graph`: a function's variable, and the calls to it from sibling functions. */
function addDeclaration(siblings: Siblings, graph: ListGraph, callee: number): void {
  const declaration = unwrap(siblings.statements[callee]);
  for (const variable of siblings.sourceCode.getDeclaredVariables(declaration as never)) {
    if (isOwnName(declaration, variable)) graph.variables.set(callee, variable);
    for (const caller of siblingCallers(siblings, variable, callee)) addEdge(graph.edges, caller, callee);
  }
}

/**
 * Whether `variable` is the name that `declaration`, a function declaration, declares. ESLint lists a function's parameters
 * among its declared variables too, after its name, so the name has to be picked out rather than taken as the last one.
 */
function isOwnName(declaration: Node, variable: Scope.Variable): boolean {
  return declaration.type === "FunctionDeclaration" && variable.name === declaration.id?.name;
}

/** The indexes of the sibling functions among the `statements` of `container`, other than `callee` itself, that call `declared`. */
function siblingCallers({ statements, container }: Siblings, declared: Scope.Variable, callee: number): number[] {
  return declared.references.flatMap((reference) => {
    const identifier = asTs(reference.identifier);
    const sibling = childOf(identifier, container);
    const caller = sibling ? statements.indexOf(sibling as Statement) : -1;
    return caller !== -1 && caller !== callee && isCallFromFunction(statements[caller], identifier) ? [caller] : [];
  });
}

/** Whether `reference`, inside the list statement `sibling`, is a call from a function: a declaration or a `const f = () => …`. */
function isCallFromFunction(sibling: Node, reference: Node): boolean {
  const declaration = unwrap(sibling);
  if (declaration.type === "FunctionDeclaration") return true;
  if (declaration.type !== "VariableDeclaration") return false;
  for (let current: Node | undefined = reference; current && current !== declaration; current = current.parent) {
    if (isFunction(current) && current.parent?.type === "VariableDeclarator" && current.parent.parent === declaration) return true;
  }
  return false;
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
      "Program, BlockStatement, StaticBlock, SwitchCase, TSModuleBlock": (node: unknown) => checkList(context, asTs<StatementList>(node)),
      ClassBody: (node: unknown) => void classes.push(asTs(node)),
      MemberExpression: (node: unknown) => collectReference(references, asTs<TSESTree.MemberExpression>(node)),
      "Program:exit": () => classes.forEach((body) => checkClass(context, body, references)),
    } as Rule.RuleListener;
  },
});

/** Keeps `expression` in `references` when it is a `this.x` or `Name.x`, which may name a method of a class around it. */
function collectReference(references: TSESTree.MemberExpression[], expression: TSESTree.MemberExpression): void {
  if (expression.object.type === "ThisExpression" || expression.object.type === "Identifier") references.push(expression);
}
