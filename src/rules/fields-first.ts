import type { Rule, SourceCode } from "eslint";
import { defineRule } from "../lib/define-rule.ts";
import { asTs, type Token, type TSESTree } from "../lib/ast.ts";
import { continuesStatement } from "../lib/safe-fix.ts";
import { blockOf, crossesDirective, guardedBefore, mergeAdjacent, removeBlock, type Block } from "../lib/moves.ts";

type Member = TSESTree.ClassElement;
type Field = TSESTree.PropertyDefinition | TSESTree.TSAbstractPropertyDefinition;

/** The fields declared after a class's first constructor, method, accessor or `static {}` block, and that member. */
interface MisplacedFields {
  body: TSESTree.ClassBody;
  first: Member;
  moved: Field[];
}

/** The class's misplaced fields, or `null` when all its fields come before its first non-field member. */
function misplacedFields(body: TSESTree.ClassBody): MisplacedFields | null {
  const firstIndex = body.body.findIndex(isNonField);
  if (firstIndex === -1) return null;
  const moved = body.body.slice(firstIndex + 1).filter(isField);
  return moved.length === 0 ? null : { body, first: body.body[firstIndex], moved };
}

/** Methods, accessors, constructors and `static {}` blocks; an index signature is neither a field nor one of these. */
function isNonField(member: Member): boolean {
  return member.type === "MethodDefinition" || member.type === "TSAbstractMethodDefinition" || member.type === "AccessorProperty" || member.type === "StaticBlock";
}

function reportMisplaced(context: Rule.RuleContext, misplaced: MisplacedFields): void {
  const sourceCode = context.sourceCode;
  const fix = moveFix(sourceCode, misplaced);
  const member = memberName(sourceCode, misplaced.first);
  for (const field of misplaced.moved) {
    context.report({ node: field.key as never, messageId: "fieldAfterMember", data: { name: memberName(sourceCode, field), member }, fix });
  }
}

function memberName(sourceCode: SourceCode, member: Member): string {
  if (member.type === "StaticBlock") return "static {}";
  if (member.type === "TSIndexSignature") return "the index signature";
  const key = sourceCode.getText(member.key as never);
  return member.computed ? `[${key}]` : key;
}

function moveFix(sourceCode: SourceCode, misplaced: MisplacedFields): Rule.ReportFixer | null {
  const { body, first, moved } = misplaced;
  if (!canMove(sourceCode, body, moved)) return null;
  const target = blockOf(sourceCode, first);
  const blocks = moved.map((field) => blockOf(sourceCode, field));
  if (!target || blocks.some((block) => !block)) return null;
  const fieldBlocks = blocks as Block[];
  if (crossesDirective(sourceCode, fieldBlocks, target.lines[0])) return null;
  const inserted = movedText(sourceCode, fieldBlocks, target);
  return (fixer) => [fixer.insertTextBeforeRange([target.lines[0], target.lines[0]], inserted), ...mergeAdjacent(sourceCode, fieldBlocks).flatMap((run) => removeBlock(fixer, sourceCode, run))];
}

/** The fields' text as it goes in above `target`, with a `;` before the first when it would otherwise continue the statement above. */
function movedText(sourceCode: SourceCode, fieldBlocks: Block[], target: Block): string {
  const previous = sourceCode.getTokenBefore({ range: [target.lines[0], target.lines[0]] } as never) as Token;
  const texts = fieldBlocks.map((block, index) => guardedBefore(sourceCode, block, fieldBlocks[index + 1]?.firstToken ?? target.firstToken));
  if (continuesStatement(previous, fieldBlocks[0].firstToken)) {
    const at = fieldBlocks[0].firstToken.range[0] - fieldBlocks[0].lines[0];
    texts[0] = `${texts[0].slice(0, at)};${texts[0].slice(at)}`;
  }
  const gap = blankAbove(sourceCode.text, target.lines[0]) ? "\n" : "";
  return `${texts.join("\n")}\n${gap}`;
}

/** Whether a blank line is directly above the line at `lineStart`. */
function blankAbove(text: string, lineStart: number): boolean {
  if (lineStart === 0) return false;
  const previousStart = text.lastIndexOf("\n", lineStart - 2) + 1;
  return text.slice(previousStart, lineStart).trim() === "";
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

function isField(member: Member): member is Field {
  return member.type === "PropertyDefinition" || member.type === "TSAbstractPropertyDefinition";
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
    return {
      ClassBody(node) {
        const misplaced = misplacedFields(asTs<TSESTree.ClassBody>(node));
        if (misplaced) reportMisplaced(context, misplaced);
      },
    };
  },
});
