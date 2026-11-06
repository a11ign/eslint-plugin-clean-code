export function notifyAll(users: string[], notify: (user: string) => void): void {
  // Loop through the users
  for (const user of users) {
    notify(user);
  }
}
