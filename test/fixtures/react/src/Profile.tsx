import { useEffect, useState } from "react";

export function Profile({ userId }: { userId: string }) {
  const [name, setName] = useState("");
  useEffect(() => {
    fetchName(userId).then(setName);
  }, []);
  return <p>{name}</p>;
}

declare function fetchName(userId: string): Promise<string>;
