import fs from "node:fs";

export function load(use: (data: Buffer) => void, render: (rows: unknown) => void, db: Database): void {
  fs.readFile("orders.json", (err, data) => {
    use(data);
  });
  db.query("select * from orders", (error, rows) => render(rows));
  fs.readFile("customers.json", (err, data) => {
    if (err) throw err;
    use(data);
  });
}
