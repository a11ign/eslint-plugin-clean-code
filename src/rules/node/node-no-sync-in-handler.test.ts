import { runRuleTests } from "../../testing/run-rule-tests.ts";
import rule from "./node-no-sync-in-handler.ts";

const error = (call: string) => ({ messageId: "blocking", data: { call } });

runRuleTests("node-no-sync-in-handler", rule, {
  valid: [
    { name: "a ...Sync() call at module top level is startup code", code: 'const orders = fs.readFileSync("orders.json");' },
    { name: "a ...Sync() call in a function that is not passed as a handler", code: 'function loadConfig() {\n  return fs.readFileSync("config.json");\n}' },
    { name: "a name that ends in lowercase sync", code: 'server.on("request", () => {\n  tools.rsync("a", "b");\n});' },
    { name: "the asynchronous form in a handler", code: 'server.on("request", async () => {\n  await fs.promises.readFile("orders.json");\n});' },
    { name: "a framework router is left out (owner sign-off)", code: 'app.get("/orders", (req, res) => {\n  res.send(fs.readFileSync("orders.json"));\n});' },
    { name: "createServer on a module other than http, https or net", code: "tls.createServer(() => {\n  fs.readFileSync(\"key.pem\");\n});" },
    { name: "a named function that is never passed as a handler", code: 'function load() {\n  return fs.readFileSync("x");\n}\nserver.on("request", other);' },
    { name: "a function named Sync alone is not a ...Sync() call", code: 'emitter.on("data", () => {\n  lib.Sync();\n});' },
  ],
  invalid: [
    {
      name: "fs.readFileSync in an http request handler",
      code: 'http.createServer((req, res) => {\n  res.end(fs.readFileSync("orders.json"));\n});',
      output: null,
      errors: [{ ...error("fs.readFileSync"), line: 2 }],
    },
    { name: "https.createServer with options, then the handler", code: "https.createServer(options, function (req, res) {\n  crypto.pbkdf2Sync(a, b, 1, 32, \"sha256\");\n});", output: null, errors: [error("crypto.pbkdf2Sync")] },
    { name: "net.createServer's connection handler", code: 'net.createServer((socket) => {\n  child_process.execSync("ls");\n});', output: null, errors: [error("child_process.execSync")] },
    { name: "an EventEmitter .on handler", code: 'emitter.on("data", () => {\n  fs.writeFileSync("log", "x");\n});', output: null, errors: [error("fs.writeFileSync")] },
    { name: ".once", code: 'emitter.once("ready", () => fs.readFileSync("x"));', output: null, errors: [error("fs.readFileSync")] },
    { name: ".addListener", code: 'emitter.addListener("data", () => fs.readFileSync("x"));', output: null, errors: [error("fs.readFileSync")] },
    { name: ".prependListener", code: 'emitter.prependListener("data", () => fs.readFileSync("x"));', output: null, errors: [error("fs.readFileSync")] },
    { name: ".prependOnceListener", code: 'emitter.prependOnceListener("data", () => fs.readFileSync("x"));', output: null, errors: [error("fs.readFileSync")] },
    {
      name: "at any depth of nesting inside the handler",
      code: 'server.on("request", (req) => {\n  req.on("end", () => {\n    [1].forEach(() => fs.readFileSync("x"));\n  });\n});',
      output: null,
      errors: [error("fs.readFileSync")],
    },
    {
      name: "a named function declaration passed as the handler",
      code: 'function handle(req, res) {\n  res.end(fs.readFileSync("orders.json"));\n}\nhttp.createServer(handle);',
      output: null,
      errors: [{ ...error("fs.readFileSync"), line: 2 }],
    },
    { name: "a const arrow passed as the handler", code: 'const onData = () => fs.readFileSync("x");\nstream.on("data", onData);', output: null, errors: [error("fs.readFileSync")] },
    { name: "in a JavaScript file", filename: "file.js", code: 'emitter.on("data", function () {\n  fs.readFileSync("x");\n});', output: null, errors: [error("fs.readFileSync")] },
  ],
});
