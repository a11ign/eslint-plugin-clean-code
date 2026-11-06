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
    const open: Array<{ call: TSESTree.CallExpression; asserted: boolean }> = [];
    return {
      CallExpression(node) {
        const call = asTs<TSESTree.CallExpression>(node);
        const path = calleePath(call.callee);
        if (path && open.length > 0 && isAssertion(path, extra)) for (const test of open) test.asserted = true;
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
