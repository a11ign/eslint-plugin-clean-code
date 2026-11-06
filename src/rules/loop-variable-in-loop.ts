import type { Rule, Scope, SourceCode } from "eslint";
import { defineRule } from "../lib/define-rule.ts";
import { asTs, isFunction, type Node, type Token, type TSESTree } from "../lib/ast.ts";
import { removeRange } from "../lib/safe-fix.ts";

type Declarator = TSESTree.VariableDeclarator & { id: TSESTree.Identifier };

const STATEMENT_LISTS = new Set(["Program", "BlockStatement", "StaticBlock", "TSModuleBlock", "SwitchCase"]);

function siblingsOf(node: Node): readonly Node[] | null {
  const parent = node.parent;
  if (!parent || !STATEMENT_LISTS.has(parent.type)) return null;
  return parent.type === "SwitchCase" ? parent.consequent : (parent as { body: Node[] }).body;
}

/** Whether `expression` is `name = …`. */
function assigns(expression: Node | null | undefined, name: string): expression is TSESTree.AssignmentExpression {
  return expression?.type === "AssignmentExpression" && expression.operator === "=" && expression.left.type === "Identifier" && expression.left.name === name;
}

/** Whether a `for` statement's init assigns `name`, on its own or in a comma-separated list. */
function initAssigns(loop: TSESTree.ForStatement, name: string): boolean {
  const init = loop.init;
  if (init?.type === "SequenceExpression") return init.expressions.some((expression) => assigns(expression, name));
  return assigns(init, name);
}

function within(node: Node, range: [number, number]): boolean {
  return node.range[0] >= range[0] && node.range[1] <= range[1];
}

/** Whether a reference sits in a function or class nested in the loop, where a per-iteration `let` would change what it sees. */
function inNestedScope(identifier: Node, loop: Node): boolean {
  for (let current: Node | undefined = identifier.parent; current && current !== loop; current = current.parent) {
    if (isFunction(current) || current.type === "ClassBody") return true;
  }
  return false;
}

interface Candidate {
  declaration: TSESTree.VariableDeclaration;
  declarator: Declarator;
  loop: TSESTree.ForStatement;
  variable: Scope.Variable;
}

/**
 * The catalog's conditions for moving the declaration into the loop header: every reference is in the loop and not in a
 * nested function or class, the declaration declares only the variable with no initializer and comes directly before the
 * loop, and the loop's init only assigns it. The value assigned must not read the variable either, because in
 * `for (let i = …)` that read is in the temporal dead zone.
 */
function canMove(candidate: Candidate, siblings: readonly Node[]): boolean {
  const { declaration, declarator, loop, variable } = candidate;
  if (declaration.declarations.length !== 1 || declarator.init || declaration.declare) return false;
  if (siblings[siblings.indexOf(declaration) + 1] !== loop || !assigns(loop.init, declarator.id.name)) return false;
  const right = loop.init.right;
  return variable.references.every((reference) => {
    const identifier = asTs(reference.identifier);
    return within(identifier, loop.range) && !inNestedScope(identifier, loop) && !within(identifier, right.range);
  });
}

function moveFix(sourceCode: SourceCode, candidate: Candidate): Rule.ReportFixer {
  const { declaration, declarator, loop } = candidate;
  const init = loop.init as TSESTree.AssignmentExpression;
  const next = sourceCode.getTokenAfter(declaration as never) as Token;
  const sameLine = next.loc.start.line === declaration.loc.end.line;
  const removed: [number, number] = [declaration.range[0], sameLine ? next.range[0] : declaration.range[1]];
  const header = `let ${sourceCode.getText(declarator.id as never)} = ${sourceCode.getText(init.right as never)}`;
  return (fixer) => [removeRange(fixer, sourceCode, removed), fixer.replaceTextRange(init.range, header)];
}

export default defineRule({
  name: "loop-variable-in-loop",
  type: "suggestion",
  description: "Declare a loop's control variable in the loop statement instead of before it.",
  book: {
    entry: "FMT-05",
    chapter: "6 Formatting § Variable Declarations",
    passage: "Variables should be declared as close to their usage as possible.",
  },
  fixable: "code",
  messages: {
    declaredBeforeLoop: {
      problem: "`{{name}}` is the loop's control variable, but it is declared before the loop and not read after it.",
      refactor: "declare it in the loop statement, `for (let {{name}} = …; …)`, which the book says control variables usually are.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    return {
      VariableDeclaration(node) {
        const declaration = asTs<TSESTree.VariableDeclaration>(node);
        const siblings = siblingsOf(declaration);
        if (declaration.kind !== "let" || !siblings) return;
        const later = siblings.slice(siblings.indexOf(declaration) + 1);
        for (const declarator of declaration.declarations) {
          if (declarator.id.type !== "Identifier") continue;
          const name = declarator.id.name;
          const loop = later.find((statement): statement is TSESTree.ForStatement => statement.type === "ForStatement" && initAssigns(statement, name));
          const variable = sourceCode.getDeclaredVariables(declarator as never).find((v) => v.name === name);
          if (!loop || !variable) continue;
          const readAfter = variable.references.some((reference) => reference.isRead() && reference.identifier.range![0] >= loop.range[1]);
          if (readAfter) continue;
          const candidate: Candidate = { declaration, declarator: declarator as Declarator, loop, variable };
          context.report({
            node: declarator.id as never,
            messageId: "declaredBeforeLoop",
            data: { name },
            fix: canMove(candidate, siblings) ? moveFix(sourceCode, candidate) : null,
          });
        }
      },
    };
  },
});
