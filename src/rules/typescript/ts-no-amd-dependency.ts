import { defineTypescriptRule } from "../../lib/define-rule.ts";

/** A `///` comment whose text opens with the `amd-dependency` tag: `/// <amd-dependency path="legacy" />`. */
const AMD_DEPENDENCY = /^\/\s*<amd-dependency\b/;

export default defineTypescriptRule({
  name: "ts-no-amd-dependency",
  type: "suggestion",
  description: "Load a module with `import`, not with a `/// <amd-dependency />` directive.",
  source: {
    entry: "TS-14",
    book: "Programming TypeScript",
    section: "§ Deprecated Directives",
    passage: "You should never use the `amd-dependency` directive … and instead stick to a regular `import` .",
  },
  messages: {
    directive: {
      problem: "`/// <amd-dependency />` is a deprecated directive that loads a module outside the module system.",
      refactor: "replace it with an `import` of the module.",
    },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (comment.type === "Line" && AMD_DEPENDENCY.test(comment.value)) context.report({ loc: comment.loc!, messageId: "directive" });
        }
      },
    };
  },
});
