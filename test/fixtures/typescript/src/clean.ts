import type { User } from "./user";

export function sameUser(a: User, b: User): boolean {
  return a.id === b.id;
}
