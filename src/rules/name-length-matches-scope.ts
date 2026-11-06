import { defineRule } from "../lib/define-rule.ts";
import { asTs } from "../lib/ast.ts";
import { declaredVariables, isExportedDeclaration, isInImportOrExport, lineSpan, variableIdentifiers, type VariableT } from "../lib/naming.ts";

const ONE_LETTER = /^[A-Za-z]$/;
const BINDING_DEFS = new Set(["Variable", "Parameter", "FunctionName", "CatchClause"]);
const DEFAULT_MAX_LINES = 3;

type Options = [{ maxLines?: number }];

function isExported(variable: VariableT): boolean {
  return variable.defs.some((def) => isExportedDeclaration(asTs(def.name))) || variableIdentifiers(variable).some(isInImportOrExport);
}

/** The book allows `e` for the error in a `catch`. */
function isAllowed(variable: VariableT): boolean {
  const def = variable.defs[0];
  return def.type === "CatchClause" && variable.name === "e";
}

export default defineRule<Options>({
  name: "name-length-matches-scope",
  type: "suggestion",
  description: "Use one-letter names only for local variables in very short scopes.",
  book: {
    entry: "NAM-02",
    chapter: "4 Meaningful Names § Use Searchable Names",
    passage: "Our preference is that very short, or single-letter, names ought *only* to be used as local variables inside very short scopes. If a variable or constant might be seen or used in multiple places in a body of code, it is best to give it a search-friendly name.",
  },
  schema: [
    {
      type: "object",
      properties: { maxLines: { type: "integer", minimum: 1, default: DEFAULT_MAX_LINES } },
      additionalProperties: false,
    },
  ],
  defaultOptions: [{ maxLines: DEFAULT_MAX_LINES }],
  messages: {
    longScope: {
      problem: "`{{name}}` is a one-letter name in a scope of {{lines}} lines (more than {{max}}).",
      refactor: "give it a search-friendly name that says what it holds; keep one-letter names for locals in scopes of a few lines.",
    },
    topLevel: {
      problem: "`{{name}}` is a one-letter name at the top level of the file, where the whole file can see it.",
      refactor: "give it a search-friendly name that says what it holds; keep one-letter names for locals in scopes of a few lines.",
    },
    exported: {
      problem: "`{{name}}` is a one-letter name that is exported, so other files use it too.",
      refactor: "give it a search-friendly name that says what it holds; keep one-letter names for locals in scopes of a few lines.",
    },
  },
  create(context) {
    const maxLines = (context.options[0] as Options[0] | undefined)?.maxLines ?? DEFAULT_MAX_LINES;
    return {
      "Program:exit"() {
        for (const variable of declaredVariables(context.sourceCode)) {
          if (!ONE_LETTER.test(variable.name) || !BINDING_DEFS.has(variable.defs[0].type) || isAllowed(variable)) continue;
          const node = asTs(variable.defs[0].name) as never;
          const data = { name: variable.name, max: String(maxLines) };
          const scope = variable.scope;
          if (isExported(variable)) context.report({ node, messageId: "exported", data });
          else if (scope.type === "module" || scope.type === "global") context.report({ node, messageId: "topLevel", data });
          else if (lineSpan(asTs(scope.block)) > maxLines) context.report({ node, messageId: "longScope", data: { ...data, lines: String(lineSpan(asTs(scope.block))) } });
        }
      },
    };
  },
});
