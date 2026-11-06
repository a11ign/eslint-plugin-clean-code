import { defineRule } from "../lib/define-rule.ts";
import { asTs, type TSESTree } from "../lib/ast.ts";

type Options = [{ max?: number }];

const DEFAULT_MAX = 2;

export default defineRule<Options>({
  name: "max-block-statements",
  type: "suggestion",
  description: "Keep the blocks inside `if`, `else`, loops, `try`, `catch` and `finally` to one or two statements.",
  book: {
    entry: "FN-05",
    chapter: "7 Clean Functions § Well-Written Prose",
    passage: "Keeping functions very small implies that the blocks within `if` statements, `else` statements, `while` statements, and so on will be only one or two lines long. Often that block will contain a call to another function.",
  },
  messages: {
    tooManyStatements: {
      problem: "This `{{kind}}` block has {{count}} statements, more than {{max}}.",
      refactor: "extract the block into a function whose name says what the block does, and call it from the block. For `try` and `catch`, extract each body into a function of its own.",
    },
  },
  schema: [
    {
      type: "object",
      properties: { max: { type: "integer", minimum: 0, default: DEFAULT_MAX } },
      additionalProperties: false,
    },
  ],
  defaultOptions: [{ max: DEFAULT_MAX }],
  create(context) {
    const max = (context.options[0] as Options[0] | undefined)?.max ?? DEFAULT_MAX;
    function check(body: TSESTree.Node | null | undefined, kind: string): void {
      if (body?.type !== "BlockStatement" || body.body.length <= max) return;
      context.report({ node: body as never, messageId: "tooManyStatements", data: { kind, count: String(body.body.length), max: String(max) } });
    }
    return {
      IfStatement(node) {
        const statement = asTs<TSESTree.IfStatement>(node);
        check(statement.consequent, "if");
        check(statement.alternate, "else");
      },
      ForStatement: (node) => check(asTs<TSESTree.ForStatement>(node).body, "for"),
      ForInStatement: (node) => check(asTs<TSESTree.ForInStatement>(node).body, "for…in"),
      ForOfStatement: (node) => check(asTs<TSESTree.ForOfStatement>(node).body, "for…of"),
      WhileStatement: (node) => check(asTs<TSESTree.WhileStatement>(node).body, "while"),
      DoWhileStatement: (node) => check(asTs<TSESTree.DoWhileStatement>(node).body, "do"),
      TryStatement(node) {
        const statement = asTs<TSESTree.TryStatement>(node);
        check(statement.block, "try");
        check(statement.handler?.body, "catch");
        check(statement.finalizer, "finally");
      },
    };
  },
});
