import { useState } from "react";

export function loadStore(newItem: string) {
  const [items] = useState([]);
  items.push(newItem);
  return items;
}
