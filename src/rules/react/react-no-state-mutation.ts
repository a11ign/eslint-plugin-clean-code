import type { Scope } from "eslint";
import { defineReactRule } from "../../lib/define-rule.ts";
import { asTs, type Node, type TSESTree } from "../../lib/ast.ts";
import { hookCalled } from "./react-hooks.ts";

const STATE_HOOKS = new Set(["useState", "useReducer"]);
const MUTATING_METHODS = new Set(["push", "pop", "shift", "unshift", "splice", "sort", "reverse", "fill", "copyWithin"]);

/** The state value of `const [state, setState] = useState(…)` or `useReducer(…)`: the identifier it is bound to. */
function stateBinding(declarator: TSESTree.VariableDeclarator): TSESTree.Identifier | null {
  if (declarator.parent.type !== "VariableDeclaration" || declarator.parent.kind !== "const") return null;
  if (declarator.id.type !== "ArrayPattern" || !hookCalled(declarator.init, STATE_HOOKS)) return null;
  const [state] = declarator.id.elements;
  return state?.type === "Identifier" ? state : null;
}

/** The outermost member expression `node` is the object of, such as `state.items.total` for `state`: what a write changes. */
function outermostMember(node: Node): TSESTree.MemberExpression | null {
  let member: TSESTree.MemberExpression | null = null;
  let current = node;
  while (current.parent?.type === "MemberExpression" && current.parent.object === current) {
    member = current.parent;
    current = member;
  }
  return member;
}

function propertyName(member: TSESTree.MemberExpression): string | null {
  if (!member.computed && member.property.type === "Identifier") return member.property.name;
  return member.property.type === "Literal" && typeof member.property.value === "string" ? member.property.value : null;
}

/** How a write through `member` mutates the state, or `null` when the member is only read. */
function mutationOf(member: TSESTree.MemberExpression): string | null {
  const { parent } = member;
  if (parent.type === "AssignmentExpression" && parent.left === member) return "assigns to a member of";
  if (parent.type === "UpdateExpression") return "assigns to a member of";
  if (parent.type === "UnaryExpression" && parent.operator === "delete") return "deletes a member of";
  const method = propertyName(member);
  if (parent.type === "CallExpression" && parent.callee === member && method !== null && MUTATING_METHODS.has(method)) return `calls \`${method}()\` on`;
  return null;
}

/** The member of the state a reference writes through, and how, or `null` when the reference only reads the state. */
function writtenMember(reference: Scope.Reference): { member: TSESTree.MemberExpression; mutation: string } | null {
  const member = outermostMember(asTs(reference.identifier));
  const mutation = member ? mutationOf(member) : null;
  return member && mutation ? { member, mutation } : null;
}

export default defineReactRule({
  name: "react-no-state-mutation",
  type: "problem",
  description: "Don't mutate a value from `useState` or `useReducer`; pass a new value to its setter.",
  source: {
    entry: "RCT-06",
    book: "Learn React with TypeScript",
    section: "§ Understanding useReducer",
    passage: "Mutating the state would result in the component not re-rendering.",
  },
  messages: {
    mutated: {
      problem: "This {{mutation}} `{{name}}`, a state value, in place, so React does not see the change and does not re-render.",
      refactor: "build a new value, such as `[...{{name}}, item]` or `{ ...{{name}}, key: value }`, and pass it to the state's setter.",
    },
  },
  create(context) {
    return {
      VariableDeclarator(node) {
        const state = stateBinding(asTs<TSESTree.VariableDeclarator>(node));
        if (!state) return;
        const variable = context.sourceCode.getDeclaredVariables(node).find((declared) => declared.name === state.name);
        for (const reference of variable?.references ?? []) {
          const written = writtenMember(reference);
          if (written) context.report({ node: written.member as never, messageId: "mutated", data: { name: state.name, mutation: written.mutation } });
        }
      },
    };
  },
});
