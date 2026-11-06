import { defineAiRule } from "../../lib/define-rule.ts";
import { asTs, type TSESTree } from "../../lib/ast.ts";
import { shortQuote } from "../../lib/quote.ts";

/** The placeholders AI-generated code leaves for a person to fill in, matched against the whole string, ignoring case. */
const DEFAULT_PATTERNS = [
  String.raw`^your[-_ ].+[-_ ]here$`,
  String.raw`^YOUR_[A-Z_]+$`,
  String.raw`^<(insert|your|enter) .+>$`,
  String.raw`^(replace[-_ ]?me|changeme|xxx+|placeholder)$`,
  String.raw`^sk-(xxx+|\.\.\.)$`,
];

interface Options {
  patterns?: string[];
}

/**
 * Whether the string names something rather than being a value: a property key, a computed member name (`el["placeholder"]`),
 * a module specifier, or a TypeScript literal type.
 */
function isName(node: TSESTree.Node): boolean {
  const parent = node.parent;
  if (!parent) return false;
  if ((parent.type === "Property" || parent.type === "PropertyDefinition" || parent.type === "MethodDefinition") && parent.key === node) return true;
  if (parent.type === "MemberExpression" && parent.property === node) return true;
  if (parent.type === "TSLiteralType") return true;
  return (parent.type === "ImportDeclaration" || parent.type === "ExportNamedDeclaration" || parent.type === "ExportAllDeclaration" || parent.type === "ImportExpression") && parent.source === node;
}

export default defineAiRule<[Options]>({
  name: "ai-no-placeholder-values",
  type: "problem",
  description: "Don't leave placeholder strings such as `\"YOUR_API_KEY\"` or `\"<insert token>\"` in the code.",
  pattern: {
    entry: "AI-05",
    name: "placeholder values",
    harm: "a placeholder looks like a working value, so the code runs and fails later, at the call that sends it, instead of at startup.",
  },
  messages: {
    placeholder: {
      problem: "\"{{text}}\" is a placeholder, not a value.",
      refactor: "read the value from configuration or the environment and fail at startup when it is missing; a sample value belongs in a doc file or an `.env.example`.",
    },
  },
  schema: [
    {
      type: "object",
      properties: { patterns: { type: "array", items: { type: "string" }, uniqueItems: true } },
      additionalProperties: false,
    },
  ],
  defaultOptions: [{ patterns: [] }],
  create(context) {
    const extra = (context.options[0] as Options | undefined)?.patterns ?? [];
    const patterns = [...DEFAULT_PATTERNS, ...extra].map((pattern) => new RegExp(pattern, "iu"));
    function check(node: TSESTree.Node, text: string) {
      if (isName(node) || !patterns.some((pattern) => pattern.test(text))) return;
      context.report({ node: node as never, messageId: "placeholder", data: { text: shortQuote(text) } });
    }
    return {
      Literal(node) {
        const literal = asTs<TSESTree.Literal>(node);
        if (typeof literal.value === "string") check(literal, literal.value);
      },
      TemplateLiteral(node) {
        const template = asTs<TSESTree.TemplateLiteral>(node);
        if (template.expressions.length === 0) check(template, template.quasis[0].value.cooked ?? "");
      },
    };
  },
});
