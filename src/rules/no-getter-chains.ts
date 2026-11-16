import { defineRule } from "../lib/define-rule.ts";
import { asTs, type Node, type TSESTree } from "../lib/ast.ts";
import { unwrapTs } from "../lib/classes.ts";

const DEFAULT_CHAIN_LENGTH = 2;

/** A getter's name: `get` and an uppercase letter, but not `getOr` and an uppercase letter (`getOrCreate`, `getOrDefault`). */
const GETTER = /^get[A-Z]/;
const GET_OR = /^getOr[A-Z]/;

const TYPE_WRAPPERS = new Set(["TSNonNullExpression", "TSAsExpression", "TSTypeAssertion", "TSSatisfiesExpression"]);

interface Options {
  chainLength?: number;
}

/** The getter call made on the result of `call`, which continues the chain. */
function nextGetter(call: TSESTree.CallExpression): TSESTree.CallExpression | null {
  const outer = outermostTypeWrapper(call);
  const member = outer.parent;
  if (member?.type !== "MemberExpression" || member.object !== outer) return null;
  const nextCall = member.parent;
  return nextCall?.type === "CallExpression" && nextCall.callee === member && getterName(nextCall) ? nextCall : null;
}

/** `node`, or the outermost of the type-only wrappers around it (`x!`, `x as T`, `<T>x`, `x satisfies T`). */
function outermostTypeWrapper(node: Node): Node {
  let current = node;
  while (current.parent && TYPE_WRAPPERS.has(current.parent.type)) current = current.parent;
  return current;
}

/** The names of the getter calls of the chain that ends in `call`, first to last: `getB()`, `getC()`. */
function chainNames(call: TSESTree.CallExpression): string[] {
  const names: string[] = [];
  for (let link: TSESTree.CallExpression | null = call; link; link = previousGetter(link)) names.unshift(`${getterName(link)}()`);
  return names;
}

/** The getter call whose result `call` is made on: `a.getB()` for `a.getB().getC()`. */
function previousGetter(call: TSESTree.CallExpression): TSESTree.CallExpression | null {
  const object = unwrapTs((call.callee as TSESTree.MemberExpression).object);
  return getterName(object) ? (object as TSESTree.CallExpression) : null;
}

/** The getter name of a call such as `x.getOptions()` with no arguments, or null when the call is not a getter call. */
function getterName(node: Node): string | null {
  if (node.type !== "CallExpression" || node.arguments.length > 0) return null;
  const callee = node.callee;
  if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return null;
  const name = callee.property.name;
  return GETTER.test(name) && !GET_OR.test(name) ? name : null;
}

export default defineRule<[Options]>({
  name: "no-getter-chains",
  type: "suggestion",
  description: "Do not chain getter calls through the objects a getter returns.",
  book: {
    entry: "OBJ-02",
    chapter: "12 Objects and Data Structures § Trainwrecks",
    passage: "Chains of calls like this are generally considered to be sloppy style and should be avoided.",
  },
  messages: {
    getterChain: {
      problem: "`{{chain}}` chains {{count}} getter calls, so this code knows the inner structure of every object along the chain.",
      refactor: "Tell the Other Guy: tell the first object to do the work you need (`ctxt.createScratchFileStream(name)` instead of `ctxt.getOptions().getScratchDir().getAbsolutePath()`), instead of asking it for the objects it holds.",
    },
  },
  schema: [
    {
      type: "object",
      properties: {
        chainLength: { type: "integer", minimum: 2, default: DEFAULT_CHAIN_LENGTH, description: "The number of chained getter calls that is reported." },
      },
      additionalProperties: false,
    },
  ],
  defaultOptions: [{ chainLength: DEFAULT_CHAIN_LENGTH }],
  create(context) {
    const options = (context.options[0] ?? {}) as Options;
    const chainLength = options.chainLength ?? DEFAULT_CHAIN_LENGTH;
    return {
      CallExpression(node) {
        const call = asTs<TSESTree.CallExpression>(node);
        if (!getterName(call) || nextGetter(call)) return;
        const names = chainNames(call);
        if (names.length >= chainLength) context.report({ node, messageId: "getterChain", data: { chain: names.join("."), count: String(names.length) } });
      },
    };
  },
});
