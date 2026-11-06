import { runRuleTests } from "../testing/run-rule-tests.ts";
import rule from "./no-number-series-names.ts";

runRuleTests("no-number-series-names", rule, {
  valid: [
    "function copyChars(source, destination) { return [source, destination]; }",
    { name: "one-letter stems are ordered coordinates, as the book allows", code: "function distance(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }" },
    { name: "digits that are part of a term do not form a series", code: "const sha1 = 'a'; const sha256 = 'b'; const utf8 = 1; const utf16 = 2; const toBase64 = 1; const fromBase32 = 2; const es2015 = 1; const es2020 = 2; const int32 = 1; const int64 = 2;" },
    { name: "one numbered name alone is not a series", code: "const list1 = [];" },
    { name: "numbered names in different scopes", code: "const list1 = []; function f() { const list2 = []; return list2; }" },
    { name: "different stems", code: "const list1 = []; const item2 = 1;" },
    { name: "a property is not a binding", code: "const o = { list1: [], list2: [] };" },
  ],
  invalid: [
    {
      name: "the book's `a1`, `a2` with a longer stem: `list1`, `list2`",
      code: "const list1 = [];\nconst list2 = [];",
      output: null,
      errors: [{ messageId: "series", line: 1 }, { messageId: "series", line: 2 }],
    },
    { name: "parameters", code: "function copy(arg1, arg2, arg3) { return [arg1, arg2, arg3]; }", output: null, errors: 3 },
    { name: "an underscore before the number", code: "let value_1 = 1; let value_2 = 2;", output: null, errors: 2 },
    { name: "the bare stem with a numbered name: only the numbered one is reported", code: "const result = 1;\nconst result2 = 2;", output: null, errors: [{ messageId: "series", line: 2 }] },
    { name: "functions and classes in one scope", code: "function step1() {}\nfunction step2() {}\nclass Handler1 {}\nclass Handler2 {}", output: null, errors: 4 },
    { name: "a term elsewhere in the name does not hide the series", code: "const sha256Digest1 = 'a'; const sha256Digest2 = 'b';", output: null, errors: 2 },
  ],
});
