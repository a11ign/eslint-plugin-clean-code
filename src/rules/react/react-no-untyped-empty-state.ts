import { defineReactRule } from "../../lib/define-rule.ts";
import { asTs, type TSESTree } from "../../lib/ast.ts";
import { hookCalled } from "./react-hooks.ts";

const USE_STATE = new Set(["useState"]);

/** `useState([])` with no type argument: TypeScript gives the state `any[]` (or `never[]`). */
function isUntypedEmptyArrayState(call: TSESTree.CallExpression): boolean {
  if (!hookCalled(call, USE_STATE) || call.typeArguments || call.arguments.length !== 1) return false;
  const [initial] = call.arguments;
  return initial.type === "ArrayExpression" && initial.elements.length === 0;
}

export default defineReactRule({
  name: "react-no-untyped-empty-state",
  type: "problem",
  description: "Give `useState([])` a type argument in a `.tsx` file, so the state is not an array of `any`.",
  source: {
    entry: "RCT-07",
    book: "Learn React with TypeScript",
    section: "§ Answers",
    passage: "Another problem is that the **data** state will have the **any[]** type, which isn't ideal.",
  },
  messages: {
    untyped: {
      problem: "`useState([])` has no type argument, so TypeScript cannot know what the array holds.",
      refactor: "name the element type, such as `useState<User[]>([])`.",
    },
  },
  create(context) {
    if (!context.filename.endsWith(".tsx")) return {};
    return {
      CallExpression(node) {
        if (isUntypedEmptyArrayState(asTs<TSESTree.CallExpression>(node))) context.report({ node, messageId: "untyped" });
      },
    };
  },
});
