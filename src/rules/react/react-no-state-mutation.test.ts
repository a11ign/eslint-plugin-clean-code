import { runRuleTests } from "../../testing/run-rule-tests.ts";
import rule from "./react-no-state-mutation.ts";

const tsx = (body: string) => `function List() {\n  const [items, setItems] = useState([]);\n${body}\n}`;

runRuleTests("react-no-state-mutation", rule, {
  valid: [
    { name: "a new array passed to the setter", filename: "file.tsx", code: tsx("  setItems([...items, newItem]);") },
    { name: "a sorted copy", filename: "file.tsx", code: tsx("  const sorted = [...items].sort();") },
    { name: "toSorted, which copies", filename: "file.tsx", code: tsx("  const sorted = items.toSorted();") },
    { name: "a copy of an object with a new member", filename: "file.tsx", code: "function Cart() {\n  const [cart, setCart] = useState({ total: 0 });\n  setCart({ ...cart, total: 1 });\n}" },
    { name: "reading members", filename: "file.tsx", code: tsx("  const first = items[0];\n  const count = items.length;") },
    { name: "a non-mutating method", filename: "file.tsx", code: tsx("  const names = items.map((item) => item.name);") },
    { name: "a different binding of the same name in an inner scope", filename: "file.tsx", code: tsx("  const add = (items) => items.push(1);") },
    { name: "a useRef value, which is mutable", filename: "file.tsx", code: "function Timer() {\n  const ticks = useRef([]);\n  ticks.current.push(1);\n}" },
    { name: "a mutation of a value from another hook", filename: "file.tsx", code: "function List() {\n  const [items] = useItems();\n  items.push(1);\n}" },
    { name: "the setter, not the state", filename: "file.tsx", code: tsx("  setItems.displayName = 'set';") },
    { name: "a let binding, which may be reassigned to a copy", filename: "file.tsx", code: "function List() {\n  let [items] = useState([]);\n  items = [...items];\n  items.push(1);\n}" },
  ],
  invalid: [
    {
      name: "the ticket's case: push on an array held in useState",
      filename: "file.tsx",
      code: tsx("  items.push(newItem);"),
      output: null,
      errors: [{ messageId: "mutated", data: { name: "items", mutation: "calls `push()` on" }, line: 3 }],
    },
    ...["pop", "shift", "unshift", "splice", "sort", "reverse", "fill", "copyWithin"].map((method) => ({
      name: `${method}() on the state`,
      filename: "file.tsx",
      code: tsx(`  items.${method}();`),
      output: null,
      errors: [{ messageId: "mutated", data: { name: "items", mutation: `calls \`${method}()\` on` } }],
    })),
    { name: "an assignment to a member", filename: "file.tsx", code: "function Cart() {\n  const [cart, setCart] = useState({ total: 0 });\n  cart.total = 1;\n}", output: null, errors: [{ messageId: "mutated", data: { name: "cart", mutation: "assigns to a member of" } }] },
    { name: "an assignment to an index", filename: "file.tsx", code: tsx("  items[0] = newItem;"), output: null, errors: [{ messageId: "mutated" }] },
    { name: "a compound assignment", filename: "file.tsx", code: "function Cart() {\n  const [cart] = useState({ total: 0 });\n  cart.total += 1;\n}", output: null, errors: [{ messageId: "mutated" }] },
    { name: "an increment", filename: "file.tsx", code: "function Cart() {\n  const [cart] = useState({ total: 0 });\n  cart.total++;\n}", output: null, errors: [{ messageId: "mutated", data: { name: "cart", mutation: "assigns to a member of" } }] },
    { name: "delete", filename: "file.tsx", code: "function Cart() {\n  const [cart] = useState({ total: 0 });\n  delete cart.total;\n}", output: null, errors: [{ messageId: "mutated", data: { name: "cart", mutation: "deletes a member of" } }] },
    { name: "a nested member", filename: "file.tsx", code: "function Cart() {\n  const [cart] = useState({ lines: [] });\n  cart.lines.push(1);\n}", output: null, errors: [{ messageId: "mutated", data: { name: "cart", mutation: "calls `push()` on" } }] },
    { name: "inside an event handler", filename: "file.tsx", code: tsx("  const onAdd = () => items.push(newItem);"), output: null, errors: [{ messageId: "mutated" }] },
    { name: "React.useState", filename: "file.tsx", code: "function List() {\n  const [items] = React.useState([]);\n  items.push(1);\n}", output: null, errors: [{ messageId: "mutated" }] },
    { name: "the state of useReducer", filename: "file.tsx", code: "function Cart() {\n  const [state, dispatch] = useReducer(reducer, { total: 0 });\n  state.total = 1;\n}", output: null, errors: [{ messageId: "mutated", data: { name: "state", mutation: "assigns to a member of" } }] },
    { name: "in a .jsx file", filename: "file.jsx", code: tsx("  items.push(newItem);"), output: null, errors: [{ messageId: "mutated" }] },
  ],
});
