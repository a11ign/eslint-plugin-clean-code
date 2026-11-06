import { defineTypescriptRule } from "../../lib/define-rule.ts";
import { asTs, isModule, type TSESTree } from "../../lib/ast.ts";

export default defineTypescriptRule({
  name: "ts-no-module-augmentation",
  type: "suggestion",
  description: "Wrap a module and export the wrapper, instead of augmenting the module with `declare module \"…\"`.",
  source: {
    entry: "TS-15",
    book: "Programming TypeScript",
    section: "§ Modules",
    passage: "it can make your modules brittle and dependent on load order.",
  },
  messages: {
    augmentation: {
      problem: "`declare module \"{{name}}\"` in a module changes what every importer of \"{{name}}\" sees, depending on what was loaded first.",
      refactor: "write a module that imports \"{{name}}\" and exports a wrapper, and import the wrapper instead.",
    },
  },
  create(context) {
    if (!isModule(context.sourceCode)) return {};
    return {
      TSModuleDeclaration(node: unknown) {
        const declaration = asTs<TSESTree.TSModuleDeclaration>(node);
        if (declaration.id.type !== "Literal") return;
        context.report({ node: declaration as never, messageId: "augmentation", data: { name: String(declaration.id.value) } });
      },
    };
  },
});
