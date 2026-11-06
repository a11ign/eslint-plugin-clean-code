import { defineRule } from "../lib/define-rule.ts";
import { asTs, type Node, type TSESTree } from "../lib/ast.ts";
import { unwrapTs } from "../lib/classes.ts";

const DEFAULT_CHAIN_LENGTH = 2;

/** A getter's name: `get` and an uppercase letter, but not `getOr` and an uppercase letter (`getOrCreate`, `getOrDefault`). */
const GETTER = /^get[A-Z]/;
const GET_OR = /^getOr[A-Z]/;

interface Options {
  chainLength?: number;
}

/** The getter name of a call such as `x.getOptions()` with no arguments, or null when the call is not a getter call. */
function getterName(node: Node): string | null {
  if (node.type !== "CallExpression" || node.arguments.length > 0) return null;
  const callee = node.callee;
  if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return null;
  const name = callee.property.name;
  return GETTER.test(name) && !GET_OR.test(name) ? name : null;
}

/** The getter call whose result `call` is made on: `a.getB()` for `a.getB().getC()`. */
function previousGetter(call: TSESTree.CallExpression): TSESTree.CallExpression | null {
  const object = unwrapTs((call.callee as TSESTree.MemberExpression).object);
  return getterName(object) ? (object as TSESTree.CallExpression) : null;
}

/** The getter call made on the result of `call`, which continues the chain. */
function nextGetter(call: TSESTree.CallExpression): TSESTree.CallExpression | null {
  let parent: Node | undefined = call.parent;
  let child: Node = call;
  while (parent && (parent.type === "TSNonNullExpression" || parent.type === "TSAsExpression" || parent.type === "TSTypeAssertion" || parent.type === "TSSatisfiesExpression")) {
    child = parent;
    parent = parent.parent;
  }
  if (parent?.type !== "MemberExpression" || parent.object !== child) return null;
  const call2 = parent.parent;
  return call2?.type === "CallExpression" && call2.callee === parent && getterName(call2) ? call2 : null;
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
        const names: string[] = [];
        for (let link: TSESTree.CallExpression | null = call; link; link = previousGetter(link)) names.unshift(`${getterName(link)}()`);
        if (names.length < chainLength) return;
        context.report({ node, messageId: "getterChain", data: { chain: names.join("."), count: String(names.length) } });
      },
    };
  },
});
