import { defineTypescriptRule } from "../../lib/define-rule.ts";
import { asTs, type TSESTree } from "../../lib/ast.ts";

export default defineTypescriptRule({
  name: "ts-no-definite-assignment-assertion",
  type: "suggestion",
  description: "Assign a variable or a class field where it is declared, instead of asserting with `!` that it will be.",
  source: {
    entry: "TS-04",
    book: "Programming TypeScript",
    section: "§ Definite Assignment Assertions",
    passage: "if you find yourself using definite assignment assertions often, you might be doing something wrong.",
  },
  messages: {
    variable: {
      problem: "`{{name}}!` tells TypeScript the variable is assigned before it is read, so the compiler no longer checks that it is.",
      refactor: "assign the value where the variable is declared, or declare it where its value is known.",
    },
    field: {
      problem: "`{{name}}!` tells TypeScript the field is assigned before it is read, so the compiler no longer checks that it is.",
      refactor: "assign the field in its declaration or in the constructor, or pass its value to the constructor.",
    },
  },
  create(context) {
    const nameOf = (node: TSESTree.Node) => context.sourceCode.getText(node as never);
    return {
      VariableDeclarator(node) {
        const declarator = asTs<TSESTree.VariableDeclarator>(node);
        if (declarator.definite) context.report({ node, messageId: "variable", data: { name: nameOf(declarator.id) } });
      },
      PropertyDefinition(node) {
        const field = asTs<TSESTree.PropertyDefinition>(node);
        if (field.definite && !field.declare) context.report({ node, messageId: "field", data: { name: nameOf(field.key) } });
      },
    };
  },
});
