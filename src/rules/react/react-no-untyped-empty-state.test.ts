import { runRuleTests } from "../../testing/run-rule-tests.ts";
import rule from "./react-no-untyped-empty-state.ts";

runRuleTests("react-no-untyped-empty-state", rule, {
  valid: [
    { name: "a type argument", filename: "file.tsx", code: "function Users() {\n  const [users, setUsers] = useState<User[]>([]);\n}" },
    { name: "a non-empty array, whose type TypeScript infers", filename: "file.tsx", code: "function Users() {\n  const [ids] = useState([1, 2]);\n}" },
    { name: "a value whose type TypeScript infers", filename: "file.tsx", code: "function Users({ users }: Props) {\n  const [list] = useState(users);\n}" },
    { name: "an empty object", filename: "file.tsx", code: "function Users() {\n  const [byId] = useState({});\n}" },
    { name: "a .jsx file, which has no type arguments", filename: "file.jsx", code: "function Users() {\n  const [users, setUsers] = useState([]);\n}" },
    { name: "a .ts file, where the react config does not run", filename: "file.ts", code: "function useUsers() {\n  const [users, setUsers] = useState([]);\n}" },
    { name: "another hook", filename: "file.tsx", code: "function Users() {\n  const users = useMemo(() => [], []);\n  const list = useList([]);\n}" },
  ],
  invalid: [
    {
      name: "the ticket's case: useState([]) in a .tsx file",
      filename: "file.tsx",
      code: "function Users() {\n  const [users, setUsers] = useState([]);\n}",
      output: null,
      errors: [{ messageId: "untyped", line: 2 }],
    },
    { name: "React.useState([])", filename: "file.tsx", code: "function Users() {\n  const [users] = React.useState([]);\n}", output: null, errors: [{ messageId: "untyped" }] },
    { name: "not destructured", filename: "file.tsx", code: "function Users() {\n  const state = useState([]);\n}", output: null, errors: [{ messageId: "untyped" }] },
  ],
});
