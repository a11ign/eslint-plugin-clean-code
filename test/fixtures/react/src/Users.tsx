import { useState } from "react";

export function Users() {
  const [users, setUsers] = useState([]);
  return <ul onClick={() => setUsers([])}>{users.length}</ul>;
}
