import type { User } from "./user";

export function toUser(data: unknown): User {
  const user = data as User;
  return user;
}
