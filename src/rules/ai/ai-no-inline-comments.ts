import type { SourceCode } from "eslint";
import { defineAiRule } from "../../lib/define-rule.ts";
import type { Comment, Node } from "../../lib/ast.ts";
import { isDirectiveComment, isDocComment } from "../../lib/safe-fix.ts";
import { sourceComments } from "../../lib/comment-text.ts";
import { shortQuote } from "../../lib/quote.ts";

/** What marks the first comment of a file as its licence header. */
const LICENCE = /\b(copyright|licen[cs]ed?|SPDX-License-Identifier)\b|\(c\)|©/i;

interface Options {
  allow?: string[];
}

/** The declarations a doc comment documents: what a reader looks up by name, outside any function body. */
const DOCUMENTED = new Set([
  "FunctionDeclaration", "ClassDeclaration", "VariableDeclaration", "ExportNamedDeclaration", "ExportDefaultDeclaration",
  "TSInterfaceDeclaration", "TSTypeAliasDeclaration", "TSEnumDeclaration", "TSModuleDeclaration", "TSDeclareFunction",
  "MethodDefinition", "PropertyDefinition", "AccessorProperty", "TSAbstractMethodDefinition", "TSAbstractPropertyDefinition",
  "TSAbstractAccessorProperty", "TSPropertySignature", "TSMethodSignature", "TSIndexSignature", "TSEnumMember", "Property",
]);

const FUNCTIONS = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"]);

/** The comments the rule reports: all but the licence header, tool directives, `allow` matches and attached doc comments. */
function narratingComments(sourceCode: SourceCode, firstCodeStart: number, allow: RegExp[]): Comment[] {
  const comments = sourceComments(sourceCode);
  const header = licenceHeader(comments, firstCodeStart);
  const isKept = (comment: Comment) => comment === header || isAllowed(comment, allow) || (isDocComment(comment) && isAttachedDoc(sourceCode, comment, firstCodeStart));
  return comments.filter((comment) => !isKept(comment));
}

/** The file's licence header: its first comment, when no code comes before it and it names a licence. A hashbang may precede it. */
function licenceHeader(comments: Comment[], firstCodeStart: number): Comment | undefined {
  const [first] = comments;
  return first && first.range![1] <= firstCodeStart && LICENCE.test(first.value) ? first : undefined;
}

/** Whether the rule leaves the comment alone: a tool directive, or one an `allow` pattern matches. */
function isAllowed(comment: Comment, allow: RegExp[]): boolean {
  return isDirectiveComment(comment) || allow.some((pattern) => pattern.test(comment.value));
}

/**
 * Whether a doc comment documents something: it sits directly on a declaration outside any function body, or it is the
 * file's overview, before the first statement. A doc comment between statements, or inside a function, narrates.
 */
function isAttachedDoc(sourceCode: SourceCode, comment: Comment, firstCodeStart: number): boolean {
  if (comment.range![1] <= firstCodeStart) return true;
  const next = sourceCode.getTokenAfter(comment as never, { includeComments: false });
  const declaration = next ? declarationStartingAt(sourceCode, next.range[0]) : null;
  return declaration !== null && !insideFunction(declaration);
}

/** The outermost declaration that starts at `index`, or null when none does. */
function declarationStartingAt(sourceCode: SourceCode, index: number): Node | null {
  let found: Node | null = null;
  for (let node = sourceCode.getNodeByRangeIndex(index) as Node | null; node && node.range[0] === index; node = node.parent ?? null) {
    if (DOCUMENTED.has(node.type)) found = node;
  }
  return found;
}

/** Whether `node` is inside a function's body, where the function's own doc comment is the place to explain it. */
function insideFunction(node: Node): boolean {
  for (let current = node.parent; current; current = current.parent) {
    if (FUNCTIONS.has(current.type)) return true;
  }
  return false;
}

export default defineAiRule<[Options]>({
  name: "ai-no-inline-comments",
  type: "suggestion",
  description: "Say it in the code, not in a comment: only `/** */` doc comments on declarations, a file overview and tool directives stay.",
  pattern: {
    entry: "AI-01",
    name: "narrating comments",
    harm: "a comment that narrates what the code does goes stale as the code changes, and hides that a name or a function is missing.",
  },
  messages: {
    comment: {
      problem: "The comment \"{{text}}\" explains code that should explain itself.",
      refactor: "say it in the code: a clearer name, an extracted function named for what the comment says, a JSDoc on the declaration, or a doc file for what the code cannot say.",
    },
  },
  schema: [
    {
      type: "object",
      properties: { allow: { type: "array", items: { type: "string" }, uniqueItems: true } },
      additionalProperties: false,
    },
  ],
  defaultOptions: [{ allow: [] }],
  create(context) {
    const allow = ((context.options[0] as Options | undefined)?.allow ?? []).map((pattern) => new RegExp(pattern, "u"));
    return {
      Program(program) {
        const firstCodeStart = program.body[0]?.range?.[0] ?? context.sourceCode.text.length;
        for (const comment of narratingComments(context.sourceCode, firstCodeStart, allow)) {
          context.report({ loc: comment.loc!, messageId: "comment", data: { text: shortQuote(comment.value) } });
        }
      },
    };
  },
});
