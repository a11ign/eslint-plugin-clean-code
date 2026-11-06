import { defineRule } from "../lib/define-rule.ts";
import { asTs, type TSESTree } from "../lib/ast.ts";

function isConstructorSignature(member: TSESTree.ClassElement): boolean {
  return (member.type === "TSAbstractMethodDefinition" || member.type === "MethodDefinition") && member.kind === "constructor" && member.value.type === "TSEmptyBodyFunctionExpression";
}

export default defineRule({
  name: "no-overloaded-constructors",
  type: "suggestion",
  description: "Use named static factory methods instead of overloaded constructors.",
  book: {
    entry: "NAM-13",
    chapter: "4 Meaningful Names § Method Names",
    passage: "When such constructors are overloaded, it is better to use static factory methods with names that describe the arguments.",
  },
  messages: {
    overloaded: {
      problem: "Class `{{name}}` has {{count}} constructor overloads.",
      refactor: "replace each overload with a static factory method whose name describes its arguments (`Complex.fromRealNumber(23.0)`), and keep one constructor.",
    },
  },
  create(context) {
    return {
      ClassBody(node) {
        const body = asTs<TSESTree.ClassBody>(node);
        const signatures = body.body.filter(isConstructorSignature);
        if (signatures.length < 2) return;
        const owner = body.parent as TSESTree.ClassDeclaration | TSESTree.ClassExpression;
        context.report({
          node: signatures[1] as never,
          messageId: "overloaded",
          data: { name: owner.id?.name ?? "(anonymous)", count: String(signatures.length) },
        });
      },
    };
  },
});
