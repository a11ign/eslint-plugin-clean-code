import { useState } from "react";

export function List({ newItem }: { newItem: string }) {
  const [items, setItems] = useState<string[]>([]);
  const onAdd = () => {
    items.push(newItem);
    setItems(items);
  };
  return <button onClick={onAdd}>{items.length}</button>;
}
