import fs from "node:fs";

export function readOrders(): string {
  try {
    return fs.readFileSync("orders.json", "utf8");
  } catch (error) {
    if (error.message.includes("ENOENT")) return "[]";
    throw error;
  }
}
