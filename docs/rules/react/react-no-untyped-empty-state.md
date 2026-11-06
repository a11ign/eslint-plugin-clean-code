# clean-code-book/react-no-untyped-empty-state

Give `useState([])` a type argument in a `.tsx` file, so the state is not an array of `any`.

- **Config:** `react`
- **Fix:** no
- **Catalog entry:** RCT-07 in [`docs/catalog-react.md`](../../catalog-react.md)

## What the book says

> "Another problem is that the **data** state will have the **any[]** type, which isn't ideal."

*Learn React with TypeScript*, 3rd edition, Carl Rippon, § Answers (bookCTX `learn-react-with-typescript-third-edition` chunk 7).

## What it reports

In a `.tsx` file, a call `useState([])`, or `React.useState([])`, with no type argument.

It does not report:

- `useState<Item[]>([])`;
- `useState(items)`, or any initial value that is not an empty array, whose type TypeScript infers;
- `.jsx` files, which have no type arguments, and `.ts` files, which the `react` config does not cover.

## Examples

Incorrect:

```tsx
function Users() {
  const [users, setUsers] = useState([]);
}
```

Correct:

```tsx
function Users() {
  const [users, setUsers] = useState<User[]>([]);
}
```

## Why there is no autofix

The rule cannot know the element type.
