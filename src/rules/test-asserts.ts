import type { Scope, SourceCode } from "eslint";
import { defineRule } from "../lib/define-rule.ts";
import { asTs, type TSESTree } from "../lib/ast.ts";
import { isSkipped, isTodo, readTestCall } from "../lib/test-calls.ts";

interface Options {
  assertFunctionNames?: string[];
}

/** A name that makes a call an assertion when the callee starts with it: `expect(…)`, `assert.equal(…)`, `assertTaxFor(…)`. */
const ASSERTION_PREFIX = /^(expect|assert)/;

/** A property that makes a member call an assertion: `t.assert.equal(…)` (`node:test`), `ctx.expect(…)` (Vitest), `chai.expect(…)`. */
const ASSERTION_PROPERTY = new Set(["expect", "assert"]);

/**
 * The callee as a list of names, through member accesses and calls: `assert.equal` is `["assert", "equal"]`,
 * `request(app).get("/").expect` is `["request", "get", "expect"]`. `null` when any part is computed or not a name.
 */
function calleePath(callee: TSESTree.Node): string[] | null {
  if (callee.type === "Identifier") return [callee.name];
  if (callee.type === "CallExpression") return calleePath(callee.callee);
  if (callee.type === "ChainExpression" || callee.type === "TSNonNullExpression") return calleePath(callee.expression);
  if (callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier") {
    const object = calleePath(callee.object);
    return object && [...object, callee.property.name];
  }
  return null;
}

/** Modules whose every export is an assertion: `node:assert` and its forms, and chai. */
const ASSERTION_MODULES = new Set(["assert", "node:assert", "assert/strict", "node:assert/strict", "chai"]);

/** Modules that export assertions among other things, with the exports that are assertions. */
const ASSERTION_EXPORTS = new Map([
  ["vitest", new Set(["expect", "assert"])],
  ["@jest/globals", new Set(["expect"])],
]);

/** Whether a binding imported from `source` under `imported` (`null` for a default or namespace import) is an assertion. */
function isAssertionExport(source: unknown, imported: string | null): boolean {
  if (typeof source !== "string") return false;
  if (ASSERTION_MODULES.has(source)) return true;
  return imported !== null && (ASSERTION_EXPORTS.get(source)?.has(imported) ?? false);
}

function importedName(specifier: TSESTree.ImportClause): string | null {
  if (specifier.type !== "ImportSpecifier") return null;
  return specifier.imported.type === "Identifier" ? specifier.imported.name : String(specifier.imported.value);
}

/** The module a `require("…")` call loads, or `null` when `node` is not one. */
function requiredModule(node: TSESTree.Expression | null): unknown {
  if (node?.type !== "CallExpression" || node.callee.type !== "Identifier" || node.callee.name !== "require") return null;
  const [argument] = node.arguments;
  return argument?.type === "Literal" ? argument.value : null;
}

/** The local names a `require` binds that are assertions: all of `const a = require(m)`, or the matching keys of `const { k: a } = require(m)`. */
function requiredAssertionNames(id: TSESTree.Node, source: unknown): string[] {
  if (id.type === "Identifier") return isAssertionExport(source, null) ? [id.name] : [];
  if (id.type !== "ObjectPattern") return [];
  return id.properties.flatMap((property) => {
    if (property.type !== "Property" || property.computed || property.key.type !== "Identifier") return [];
    const local = property.value.type === "AssignmentPattern" ? property.value.left : property.value;
    return local.type === "Identifier" && isAssertionExport(source, property.key.name) ? [local.name] : [];
  });
}

function importedAssertions(sourceCode: SourceCode, statement: TSESTree.ImportDeclaration): Scope.Variable[] {
  return statement.specifiers
    .filter((specifier) => isAssertionExport(statement.source.value, importedName(specifier)))
    .flatMap((specifier) => sourceCode.getDeclaredVariables(specifier as never));
}

function requiredAssertions(sourceCode: SourceCode, statement: TSESTree.VariableDeclaration): Scope.Variable[] {
  return statement.declarations.flatMap((declarator) => {
    const names = new Set(requiredAssertionNames(declarator.id, requiredModule(declarator.init)));
    return sourceCode.getDeclaredVariables(declarator as never).filter((variable) => names.has(variable.name));
  });
}

/** The variables, at the top of the file, that hold an assertion module or function, through `import` or `require`. */
function assertionBindings(sourceCode: SourceCode, program: TSESTree.Program): Set<Scope.Variable> {
  return new Set(
    program.body.flatMap((statement) => {
      if (statement.type === "ImportDeclaration") return importedAssertions(sourceCode, statement);
      if (statement.type === "VariableDeclaration") return requiredAssertions(sourceCode, statement);
      return [];
    }),
  );
}

/** The identifier at the root of a callee: `equal` in `equal(…)`, `strict` in `strict.equal(…)`, `a` in `a.ok(…)`. */
function calleeRoot(callee: TSESTree.Node): TSESTree.Identifier | null {
  if (callee.type === "Identifier") return callee;
  if (callee.type === "MemberExpression") return calleeRoot(callee.object);
  if (callee.type === "CallExpression") return calleeRoot(callee.callee);
  if (callee.type === "ChainExpression" || callee.type === "TSNonNullExpression") return calleeRoot(callee.expression);
  return null;
}

/** The variable `name` refers to in `scope`, found from the innermost scope outwards. */
function resolve(scope: Scope.Scope, name: string): Scope.Variable | null {
  for (let current: Scope.Scope | null = scope; current; current = current.upper) {
    const variable = current.set.get(name);
    if (variable) return variable;
  }
  return null;
}

type NamePattern = Array<RegExp | "**">;

/** A name with `*` wildcards as a pattern for one name: `verify*` matches `verifyTotals`. */
function wildcard(part: string): RegExp {
  const literal = part.split("*").map((text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^${literal.join(".*")}$`);
}

/** Reads `request.**.expect` or `verify*` into one matcher per name: `*` matches within one name, `**` any number of names. */
function namePattern(name: string): NamePattern {
  return name.split(".").map((part) => (part === "**" ? "**" : wildcard(part)));
}

function matches(pattern: NamePattern, path: string[]): boolean {
  if (pattern.length === 0) return path.length === 0;
  const [first, ...rest] = pattern;
  if (first === "**") return matches(rest, path) || (path.length > 0 && matches(pattern, path.slice(1)));
  return path.length > 0 && first.test(path[0]) && matches(rest, path.slice(1));
}

function isAssertion(path: string[], extra: NamePattern[]): boolean {
  if (ASSERTION_PREFIX.test(path[0])) return true;
  if (path.slice(1).some((name) => ASSERTION_PROPERTY.has(name))) return true;
  return extra.some((pattern) => matches(pattern, path));
}

export default defineRule<[Options]>({
  name: "test-asserts",
  type: "problem",
  description: "Every test asserts, so it passes or fails by itself.",
  book: {
    entry: "TST-05",
    chapter: "15 Clean Tests § Self-Validating",
    passage: "The tests should have a boolean output. Either they pass or they fail. You should not have to read through a log file to tell whether the tests pass.",
  },
  messages: {
    noAssertion: {
      problem: "This test makes no assertion, so it passes whatever the code does and someone has to read its output to know whether it worked.",
      refactor:
        "assert the result the test expects (`expect(…)`, `assert.equal(…)`, or a composed assertion such as `assertTaxFor(…)`); name a project's own assertion helpers in the `assertFunctionNames` option.",
    },
  },
  schema: [
    {
      type: "object",
      properties: {
        assertFunctionNames: {
          type: "array",
          items: { type: "string" },
          default: [],
          description: "More functions that count as assertions. `*` matches within one name, `**` across names: `verify*`, `request.**.expect`.",
        },
      },
      additionalProperties: false,
    },
  ],
  defaultOptions: [{ assertFunctionNames: [] }],
  create(context) {
    const options = (context.options[0] ?? {}) as Options;
    const extra = (options.assertFunctionNames ?? []).map(namePattern);
    /** The tests being walked, innermost last, each with whether an assertion was found in it yet. */
    const sourceCode = context.sourceCode;
    let imported = new Set<Scope.Variable>();

    /** Whether the callee's root is an assertion imported or required in this file, and not shadowed where it is called. */
    function isImportedAssertion(call: TSESTree.CallExpression): boolean {
      const root = calleeRoot(call.callee);
      if (!root || imported.size === 0) return false;
      const variable = resolve(sourceCode.getScope(root as never), root.name);
      return variable !== null && imported.has(variable);
    }

    const open: Array<{ call: TSESTree.CallExpression; asserted: boolean }> = [];
    return {
      Program(node) {
        imported = assertionBindings(sourceCode, asTs<TSESTree.Program>(node));
      },
      CallExpression(node) {
        const call = asTs<TSESTree.CallExpression>(node);
        const path = calleePath(call.callee);
        if (open.length > 0 && ((path && isAssertion(path, extra)) || isImportedAssertion(call))) for (const test of open) test.asserted = true;
        const test = readTestCall(call);
        if (!test || test.kind === "describe" || !test.callback || isTodo(test) || isSkipped(test)) return;
        open.push({ call, asserted: false });
      },
      "CallExpression:exit"(node) {
        const current = open.at(-1);
        if (current?.call !== asTs(node)) return;
        open.pop();
        if (!current.asserted) context.report({ node: current.call.callee as never, messageId: "noAssertion" });
      },
    };
  },
});
