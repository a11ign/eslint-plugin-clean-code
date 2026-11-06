import type { Rule, SourceCode } from "eslint";
import { defineRule } from "../lib/define-rule.ts";
import { asTs, type Token, type TSESTree } from "../lib/ast.ts";
import { continuesStatement } from "../lib/safe-fix.ts";
import { blockOf, guardedBefore, removeBlock, type Block } from "../lib/moves.ts";

type Member = TSESTree.ClassElement;
type Field = TSESTree.PropertyDefinition | TSESTree.TSAbstractPropertyDefinition;

function isField(member: Member): member is Field {
  return member.type === "PropertyDefinition" || member.type === "TSAbstractPropertyDefinition";
}

/** Methods, accessors, constructors and `static {}` blocks; an index signature is neither a field nor one of these. */
function isNonField(member: Member): boolean {
  return member.type === "MethodDefinition" || member.type === "TSAbstractMethodDefinition" || member.type === "AccessorProperty" || member.type === "StaticBlock";
}

function memberName(sourceCode: SourceCode, member: Member): string {
  if (member.type === "StaticBlock") return "static {}";
  if (member.type === "TSIndexSignature") return "the index signature";
  const key = sourceCode.getText(member.key as never);
  return member.computed ? `[${key}]` : key;
}

function className(body: TSESTree.ClassBody): string | null {
  const owner = body.parent as TSESTree.ClassDeclaration | TSESTree.ClassExpression;
  if (owner.id) return owner.id.name;
  const parent = owner.parent;
  return parent?.type === "VariableDeclarator" && parent.id.type === "Identifier" ? parent.id.name : null;
}

/** Whether a field's initializer names the class, or uses `this` where `this` is the class (a static field). */
function refersToClass(sourceCode: SourceCode, field: Field, name: string | null): boolean {
  if (!field.value) return false;
  return (sourceCode.getTokens(field.value as never) as Token[]).some(
    (token) => (token.type === "Identifier" && token.value === name) || (field.static && token.type === "Keyword" && token.value === "this"),
  );
}

/**
 * Whether moving the fields keeps the order everything runs in. Computed keys of the moved fields, decorators, `static {}`
 * blocks and auto-accessors all run in source order, and so may initializers that refer to the class.
 */
function canMove(sourceCode: SourceCode, body: TSESTree.ClassBody, moved: Field[]): boolean {
  if (moved.some((field) => field.computed)) return false;
  const name = className(body);
  return body.body.every((member) => {
    if (member.type === "StaticBlock" || member.type === "AccessorProperty") return false;
    if (((member as { decorators?: unknown[] }).decorators ?? []).length > 0) return false;
    return !isField(member) || !refersToClass(sourceCode, member, name);
  });
}

/** Runs of moved fields with nothing but blank space between them, each removed in one piece. */
function runs(sourceCode: SourceCode, blocks: Block[]): Block[] {
  const merged: Block[] = [];
  for (const block of blocks) {
    const last = merged[merged.length - 1];
    if (last && sourceCode.text.slice(last.lines[1], block.lines[0]).trim() === "") {
      merged[merged.length - 1] = { range: [last.range[0], block.range[1]], lines: [last.lines[0], block.lines[1]], firstToken: last.firstToken, lastToken: block.lastToken };
    } else {
      merged.push(block);
    }
  }
  return merged;
}

/** Whether a blank line is directly above the line at `lineStart`. */
function blankAbove(text: string, lineStart: number): boolean {
  if (lineStart === 0) return false;
  const previousStart = text.lastIndexOf("\n", lineStart - 2) + 1;
  return text.slice(previousStart, lineStart).trim() === "";
}

function moveFix(sourceCode: SourceCode, body: TSESTree.ClassBody, first: Member, moved: Field[]): Rule.ReportFixer | null {
  if (!canMove(sourceCode, body, moved)) return null;
  const target = blockOf(sourceCode, first);
  const blocks = moved.map((field) => blockOf(sourceCode, field));
  if (!target || blocks.some((block) => !block)) return null;
  const fieldBlocks = blocks as Block[];
  const previous = sourceCode.getTokenBefore({ range: [target.lines[0], target.lines[0]] } as never) as Token;
  const lead = continuesStatement(previous, fieldBlocks[0].firstToken) ? ";" : "";
  const texts = fieldBlocks.map((block, index) => guardedBefore(sourceCode, block, fieldBlocks[index + 1]?.firstToken ?? target.firstToken));
  const gap = blankAbove(sourceCode.text, target.lines[0]) ? "\n" : "";
  const inserted = `${lead}${texts.join("\n")}\n${gap}`;
  return (fixer) => [fixer.insertTextBeforeRange([target.lines[0], target.lines[0]], inserted), ...runs(sourceCode, fieldBlocks).flatMap((run) => removeBlock(fixer, sourceCode, run))];
}

export default defineRule({
  name: "fields-first",
  type: "suggestion",
  description: "Declare a class's fields together, above its constructor, methods and accessors.",
  book: {
    entry: "FMT-03",
    chapter: "6 Formatting § Variable Declarations",
    passage: "The important thing is for the instance variables to be declared in one well-known place. Everybody should know where to go to see the declarations.",
  },
  fixable: "code",
  messages: {
    fieldAfterMember: {
      problem: "Field `{{name}}` is declared after `{{member}}`, so the class's fields are not all in one place.",
      refactor: "move the field up with the other fields, above the first constructor, method or accessor.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    return {
      ClassBody(node) {
        const body = asTs<TSESTree.ClassBody>(node);
        const firstIndex = body.body.findIndex(isNonField);
        if (firstIndex === -1) return;
        const first = body.body[firstIndex];
        const moved = body.body.slice(firstIndex + 1).filter(isField);
        if (moved.length === 0) return;
        const fix = moveFix(sourceCode, body, first, moved);
        for (const field of moved) {
          context.report({
            node: field.key as never,
            messageId: "fieldAfterMember",
            data: { name: memberName(sourceCode, field), member: memberName(sourceCode, first) },
            fix,
          });
        }
      },
    };
  },
});
