import { useState } from "react";

export function Dialog({ isOpen }: { isOpen: boolean }) {
  if (isOpen) {
    const [title, setTitle] = useState("");
    return <input value={title} onChange={(event) => setTitle(event.target.value)} />;
  }
  return null;
}
