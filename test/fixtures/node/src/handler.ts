import fs from "node:fs";
import http from "node:http";

export const settings = fs.readFileSync("settings.json", "utf8");

export const server = http.createServer((request, response) => {
  response.end(fs.readFileSync("orders.json"));
});
