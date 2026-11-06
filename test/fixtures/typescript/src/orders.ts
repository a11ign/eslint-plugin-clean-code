export type Status = "open" | "paid" | "shipped";

export async function saveOrder(order: { id: string }): Promise<void> {
  await Promise.resolve(order);
}

export function submit(order: { id: string }): void {
  saveOrder(order);
}

export function label(status: Status): string {
  switch (status) {
    case "open":
      return "Open";
    case "paid":
      return "Paid";
  }
  return "";
}
