import type { Rule } from "eslint";
import { defineRule } from "../lib/define-rule.ts";
import { asTs, type TSESTree } from "../lib/ast.ts";

type FieldLike = TSESTree.PropertyDefinition | TSESTree.TSAbstractPropertyDefinition | TSESTree.AccessorProperty | TSESTree.TSAbstractAccessorProperty;

function fieldName(field: FieldLike | TSESTree.TSParameterProperty): string {
  if (field.type === "TSParameterProperty") {
    const parameter = field.parameter.type === "AssignmentPattern" ? field.parameter.left : field.parameter;
    return parameter.type === "Identifier" ? parameter.name : "(parameter)";
  }
  if (field.computed) return "(computed)";
  return field.key.type === "Identifier" ? field.key.name : field.key.type === "Literal" ? String(field.key.value) : "(field)";
}

export default defineRule({
  name: "no-protected-fields",
  type: "suggestion",
  description: "Avoid `protected` fields: they let code in other files, in subclasses, depend on a class's variables.",
  book: {
    entry: "FMT-02",
    chapter: "6 Formatting § Vertical Distance",
    passage: "But then closely related concepts should not be separated into different files unless you have a very good reason. Indeed, this is one of the reasons that `protected` variables should be avoided.",
  },
  messages: {
    protectedField: {
      problem: "Field `{{name}}` is `protected`, so subclasses, usually in other files, read and write this class's variable.",
      refactor: "make the field `private` and give subclasses a method that does what they need with it, or keep the code that uses it in this class.",
    },
  },
  create(context) {
    function check(node: unknown): void {
      const field = asTs<FieldLike | TSESTree.TSParameterProperty>(node);
      if (field.accessibility !== "protected") return;
      context.report({ node: node as never, messageId: "protectedField", data: { name: fieldName(field) } });
    }
    return {
      PropertyDefinition: check,
      TSAbstractPropertyDefinition: check,
      AccessorProperty: check,
      TSAbstractAccessorProperty: check,
      TSParameterProperty: check,
    } as Rule.RuleListener;
  },
});
