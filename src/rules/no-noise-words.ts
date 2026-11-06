import type { Rule } from "eslint";
import { bookMessage, defineRule, type BookSource } from "../lib/define-rule.ts";
import { asTs, type Node, type TSESTree } from "../lib/ast.ts";
import { words } from "../lib/names.ts";
import { declaredVariables, keyName } from "../lib/naming.ts";

const CLASS_NOISE = new Map([
  ["manager", "Manager"],
  ["processor", "Processor"],
  ["data", "Data"],
  ["info", "Info"],
]);

/** The type a noise suffix repeats: the keyword and its wrapper object's name. */
const TYPE_SUFFIX: Record<string, { suffix: string; keyword: string; wrapper: string }> = {
  string: { suffix: "String", keyword: "TSStringKeyword", wrapper: "String" },
  object: { suffix: "Object", keyword: "TSObjectKeyword", wrapper: "Object" },
};

const VARIABLE_DEFS = new Set(["Variable", "Parameter", "CatchClause"]);

const NAM_11: BookSource = {
  entry: "NAM-11",
  chapter: "4 Meaningful Names § Use Appropriate Parts of Speech (Class Names)",
  passage: "Avoid noise words like `Manager` , `Processor` , `Data` , or `Info` in the name of a class. We already know that classes manage and process data and info-you don't need to tell us.",
};

const CLASS_MESSAGE = {
  problem: "Class `{{name}}` has the noise word `{{word}}` in its name.",
  refactor: "name the class for the one thing it represents, without the word; if nothing is left, the class has no clear responsibility yet.",
};

function annotationOf(node: Node): TSESTree.TypeNode | null {
  return (node as { typeAnnotation?: TSESTree.TSTypeAnnotation }).typeAnnotation?.typeAnnotation ?? null;
}

/** The noise in a variable, parameter or property name: the word `variable`, or a suffix repeating its declared type. */
function nameNoise(name: string, annotated: Node): { messageId: string; data: Record<string, string> } | null {
  const parts = words(name);
  if (parts.includes("variable")) return { messageId: "variableWord", data: { name } };
  const suffix = parts.length > 1 ? TYPE_SUFFIX[parts[parts.length - 1]] : undefined;
  const type = annotationOf(annotated);
  if (!suffix || !type) return null;
  const repeats = type.type === suffix.keyword || (type.type === "TSTypeReference" && type.typeName.type === "Identifier" && type.typeName.name === suffix.wrapper);
  return repeats ? { messageId: "typeSuffix", data: { name, suffix: suffix.suffix } } : null;
}

type Property = TSESTree.PropertyDefinition | TSESTree.AccessorProperty | TSESTree.TSAbstractPropertyDefinition | TSESTree.TSAbstractAccessorProperty | TSESTree.TSPropertySignature;

function propertyName(node: Property | TSESTree.Property): string | null {
  return keyName(node.key, node.computed);
}

const rule = defineRule({
  name: "no-noise-words",
  type: "suggestion",
  description: "Leave noise words out of names: `variable`, a suffix that repeats the declared type, and `Manager`, `Processor`, `Data` or `Info` in class names.",
  book: {
    entry: "NAM-08",
    chapter: "4 Meaningful Names § Make Meaningful Distinctions",
    passage: "Noise words are redundant. The word *variable* should never appear in a variable name. The word *table* should never appear in a table name. How is `NameString` better than `Name` ?",
  },
  messages: {
    variableWord: {
      problem: "`{{name}}` has the noise word `variable` in its name.",
      refactor: "drop the word and name the binding for what its value means.",
    },
    typeSuffix: {
      problem: "`{{name}}` ends in `{{suffix}}`, which repeats its declared type.",
      refactor: "drop the suffix and let the type annotation say what type it is: `name: string`, not `nameString: string`.",
    },
    classNoise: CLASS_MESSAGE,
  },
  create(context) {
    const report = (node: Node, name: string | null, annotated: Node) => {
      const noise = name ? nameNoise(name, annotated) : null;
      if (noise) context.report({ node: node as never, messageId: noise.messageId, data: noise.data });
    };
    const checkProperty = (node: unknown) => {
      const property = asTs<Property>(node);
      report(property.key, propertyName(property), property);
    };
    const checkClass = (node: unknown) => {
      const id = asTs<TSESTree.ClassDeclaration | TSESTree.ClassExpression>(node).id;
      const word = id ? words(id.name).find((part) => CLASS_NOISE.has(part)) : undefined;
      if (id && word) context.report({ node: id as never, messageId: "classNoise", data: { name: id.name, word: CLASS_NOISE.get(word) as string } });
    };
    return {
      PropertyDefinition: checkProperty,
      AccessorProperty: checkProperty,
      TSAbstractPropertyDefinition: checkProperty,
      TSAbstractAccessorProperty: checkProperty,
      TSPropertySignature: checkProperty,
      Property(node: unknown) {
        const property = asTs<TSESTree.Property>(node);
        if (property.parent?.type !== "ObjectExpression" || property.shorthand || property.method || property.kind !== "init") return;
        report(property.key, propertyName(property), property);
      },
      ClassDeclaration: checkClass,
      ClassExpression: checkClass,
      "Program:exit"() {
        for (const variable of declaredVariables(context.sourceCode)) {
          const def = variable.defs[0];
          if (VARIABLE_DEFS.has(def.type)) report(asTs(def.name), variable.name, asTs(def.name));
        }
      },
    } as Rule.RuleListener;
  },
});

rule.meta.messages!.classNoise = bookMessage(CLASS_MESSAGE, NAM_11);

export default rule;
