# clean-code-book/react-no-state-mutation

Don't mutate a value from `useState` or `useReducer`; pass a new value to its setter.

- **Config:** `react`
- **Fix:** no
- **Catalog entry:** RCT-06 in [`docs/catalog-react.md`](../../catalog-react.md)

## What the book says

> "A new state object is created during the state change - the current state is never mutated. Mutating the state would result in the component not re-rendering."

*Learn React with TypeScript*, 3rd edition, Carl Rippon, § Understanding useReducer (bookCTX `learn-react-with-typescript-third-edition` chunk 6).

## What it reports

In a `.jsx` or `.tsx` file, for the state value `x` of `const [x, setX] = useState(…)` or `const [x, dispatch] = useReducer(…)`, also written `React.useState` and `React.useReducer`:

- an assignment to a member of `x`, or of a member nested in it: `x.total = 1`, `x[i] = v`, `x.lines.length = 0`, including `++`, `--` and compound assignment such as `x.total += 1`;
- `delete x.key`;
- a call of a mutating array method on `x`, or on a member nested in it: `push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill`, `copyWithin`.

It does not report:

- a copy: `[...x].sort()`, `x.toSorted()`, `{ ...x, total: 1 }`;
- a different binding with the same name in an inner scope, such as a parameter named `x`;
- a `useRef` value, which the book describes as "a mutable value" that "doesn't cause a re-render when changed" (chunk 7, § Summary);
- a value from any other hook, or from a `let` declaration.

A reducer's own `state` parameter is checked by `no-param-reassign` in `recommended` (RCT-05), not by this rule.

## Examples

Incorrect:

```jsx
function List({ newItem }) {
  const [items, setItems] = useState([]);
  const onAdd = () => {
    items.push(newItem);
    setItems(items);
  };
  return <button onClick={onAdd}>{items.length}</button>;
}
```

Correct:

```jsx
function List({ newItem }) {
  const [items, setItems] = useState([]);
  const onAdd = () => setItems([...items, newItem]);
  return <button onClick={onAdd}>{items.length}</button>;
}
```

## Why there is no autofix

The replacement passes a new value to the setter, and whether it should be `setX([...x, v])` or the updater form `setX((x) => [...x, v])` depends on what else changes `x` in the same render.
