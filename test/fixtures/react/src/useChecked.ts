import { useEffect, useState } from "react";

export function useChecked(ids: string[]) {
  const [checked, setChecked] = useState(false);
  if (ids.length > 0) {
    useEffect(() => setChecked(true), [ids]);
  }
  return checked;
}
