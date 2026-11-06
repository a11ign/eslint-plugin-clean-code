import * as espree from "espree";
import { defineRule } from "../lib/define-rule.ts";
import type { Comment } from "../lib/ast.ts";
import { isDirectiveComment, isDocComment } from "../lib/safe-fix.ts";
import { commentGroups, commentLines, groupLocation, isWarningComment, removeGroup } from "../lib/comment-text.ts";

interface SyntaxNode {
  type: string;
  [key: string]: unknown;
}

/** Module code first, then JSX, then script code with a top-level `return` (a commented-out function body). */
const PARSE_ATTEMPTS: espree.Options[] = [
  { ecmaVersion: "latest", sourceType: "module" },
  { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
  { ecmaVersion: "latest", sourceType: "script", ecmaFeatures: { globalReturn: true } },
];

/** Punctuation that only code has: a statement end, a block, or an assignment. */
const CODE_PUNCTUATION = /^(?:[;{}]|[-+*/%&|^]?=|\*\*=|<<=|>>>?=|&&=|\|\|=|\?\?=)$/;

function parse(text: string): { program: SyntaxNode; tokens: espree.EspreeTokens } | null {
  for (const options of PARSE_ATTEMPTS) {
    try {
      const program = espree.parse(text, { ...options, tokens: true }) as unknown as SyntaxNode & { tokens: espree.EspreeTokens };
      return { program, tokens: program.tokens };
    } catch {
      // Not code under these options; try the next ones.
    }
  }
  return null;
}

function hasCall(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  if (Array.isArray(node)) return node.some(hasCall);
  const { type } = node as SyntaxNode;
  if (type === "CallExpression" || type === "NewExpression") return true;
  return Object.entries(node).some(([key, value]) => key !== "tokens" && key !== "loc" && hasCall(value));
}

/** Words that introduce an example in prose: `e.g. parse("a=b")` reads as `e.g.parse(…)` but is a sentence. */
const PROSE_START = /^\s*(?:e\.g\.|i\.e\.|eg:|ex:|example:|usage:)/i;

const COMPARISON = new Set(["==", "!=", "===", "!==", "<", ">", "<=", ">="]);

/** A single comparison (`sum(1, 2) === 3`) states a fact about the code; nobody comments out a statement with no effect. */
function isClaim(statements: SyntaxNode[]): boolean {
  if (statements.length !== 1 || statements[0].type !== "ExpressionStatement") return false;
  const expression = statements[0].expression as SyntaxNode;
  return expression.type === "BinaryExpression" && COMPARISON.has(expression.operator as string);
}

/** Whether `text` is JavaScript statements with code syntax, and does not start with a label (so `Note: call(x)` is prose). */
function isCode(text: string): boolean {
  if (text.trim() === "" || PROSE_START.test(text)) return false;
  const parsed = parse(text);
  if (!parsed) return false;
  const statements = (parsed.program.body as SyntaxNode[]).filter((statement) => statement.type !== "EmptyStatement");
  if (statements.length === 0 || statements[0].type === "LabeledStatement" || isClaim(statements)) return false;
  return parsed.tokens.some((token) => token.type === "Punctuator" && CODE_PUNCTUATION.test(token.value)) || hasCall(parsed.program);
}

/** The text of a group of comments as code would read it: a block's `*` decoration taken off, a run's lines joined. */
function groupText(group: Comment[]): string {
  if (group[0].type === "Line") return group.map((comment) => comment.value).join("\n");
  const lines = commentLines(group[0]);
  const decorated = lines.slice(1).every((line) => line.content.trim() === "" || line.prefix.includes("*"));
  return decorated ? lines.map((line) => line.content).join("\n") : group[0].value;
}

/** Comments this rule never reads: doc comments, `@example` blocks, directives and the TODOs `no-warning-comments` reports. */
function isSkipped(comment: Comment): boolean {
  return isDocComment(comment) || /@example\b/.test(comment.value) || isDirectiveComment(comment) || isWarningComment(comment);
}

export default defineRule({
  name: "no-commented-out-code",
  type: "suggestion",
  description: "Delete commented-out code; version control keeps it.",
  book: {
    entry: "CMT-11",
    chapter: "5 Comments § Commented-Out Code",
    passage: "Few practices are as odious as commenting-out code. Commented-out code is an abomination before nature and nature's God. Don't check this stuff in!",
  },
  fixable: "code",
  messages: {
    commentedOutCode: {
      problem: "This comment holds commented-out code, which no reader can tell is still needed.",
      refactor: "delete it; the source code control system remembers it if it is ever needed again.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    return {
      Program() {
        for (const group of commentGroups(sourceCode, isSkipped)) {
          if (isSkipped(group[0]) || !isCode(groupText(group))) continue;
          context.report({
            loc: groupLocation(group),
            messageId: "commentedOutCode",
            fix: (fixer) => removeGroup(fixer, sourceCode, group),
          });
        }
      },
    };
  },
});
