import { runRuleTests } from "../../testing/run-rule-tests.ts";
import rule from "./ai-no-placeholder-implementation.ts";

runRuleTests("ai-no-placeholder-implementation", rule, {
  valid: [
    { name: "a function that throws a real error", code: "function parse(text: string) { throw new SyntaxError(\"unexpected end of input\"); }" },
    { name: "a function that does work and then throws", code: "function f() { prepare();\n throw new Error(\"Not implemented\"); }" },
    { name: "a bare return of null with no marker", code: "function find(): null { return null; }" },
    { name: "a stub return in a class named …Stub", code: "class MailerStub { send() { return null; /* stub */ } }" },
    { name: "a throw in a class named …Fake", code: "class ClockFake { now(): number { throw new Error(\"Not implemented\"); } }" },
    { name: "a throw in a class named …Mock", code: "const Repo = class RepoMock { load() { throw new Error(\"todo\"); } };" },
    { name: "an abstract method", code: "abstract class Shape { abstract area(): number; }" },
    { name: "an interface method signature", code: "interface Store { load(): string; }" },
    { name: "a return of a non-empty value with a marker", code: "function f() { return 0; // TODO: real value\n}" },
    { name: "an arrow with an expression body", code: "const f = () => null; // TODO" },
  ],
  invalid: [
    { name: "throw new Error(\"Not implemented\")", code: "function exportInvoices() { throw new Error(\"Not implemented\"); }", output: null, errors: [{ messageId: "placeholder", line: 1 }] },
    { name: "a method that throws \"not yet implemented\"", code: "class Exporter { run() { throw new Error(\"Not yet implemented\"); } }", output: null, errors: 1 },
    { name: "an arrow that throws a TODO error", code: "const f = () => { throw new TypeError(`TODO`); };", output: null, errors: 1 },
    { name: "a custom error class and \"implement me\"", code: "function f() { throw new NotImplementedError(\"implement me\"); }", output: null, errors: 1 },
    { name: "Error called without new", code: "function f() { throw Error(\"stub\"); }", output: null, errors: 1 },
    { name: "return null with a TODO comment", code: "function load() {\n  // TODO: read from disk\n  return null;\n}", output: null, errors: 1 },
    { name: "return {} with a stub comment", code: "function config() { return {}; /* stub */ }", output: null, errors: 1 },
    { name: "return [] with a not-implemented comment", code: "const list = function () { return []; // not implemented\n};", output: null, errors: 1 },
    { name: "return \"\" and undefined with markers", code: "function a() { return \"\"; // todo\n}\nfunction b() { return undefined; // todo\n}", output: null, errors: 2 },
    { name: "a method in a class whose name only contains Mock", code: "class MockingBird { sing() { throw new Error(\"Not implemented\"); } }", output: null, errors: 1 },
  ],
});
