import { runRuleTests } from "../../testing/run-rule-tests.ts";
import rule from "./ts-no-amd-dependency.ts";

runRuleTests("ts-no-amd-dependency", rule, {
  valid: [
    { name: "an import", code: "import legacy from \"legacy\";\nlegacy();" },
    { name: "an amd-module directive, which the book lists among the ones to use", code: "/// <amd-module name=\"orders\" />\nexport const total = 1;" },
    { name: "a reference directive, which is TS-13", code: "/// <reference path=\"./legacy.d.ts\" />\nexport const total = 1;" },
    { name: "a block comment naming the directive", code: "/* <amd-dependency path=\"legacy\" /> */\nexport const total = 1;" },
    { name: "a two-slash comment naming the directive", code: "// <amd-dependency path=\"legacy\" />\nexport const total = 1;" },
    { name: "a comment that mentions the directive in prose", code: "/// We removed every amd-dependency directive.\nexport const total = 1;" },
  ],
  invalid: [
    {
      name: "the ticket's case: /// <amd-dependency path=\"legacy\" />",
      code: "/// <amd-dependency path=\"legacy\" />\nexport const total = 1;",
      output: null,
      errors: [{ messageId: "directive", line: 1 }],
    },
    {
      name: "with a name attribute, in JavaScript",
      filename: "file.js",
      code: "///<amd-dependency path=\"legacy\" name=\"legacy\"/>\nlegacy();",
      output: null,
      errors: [{ messageId: "directive" }],
    },
    {
      name: "two directives",
      code: "/// <amd-dependency path=\"a\" />\n/// <amd-dependency path=\"b\" />\nexport const total = 1;",
      output: null,
      errors: [{ messageId: "directive", line: 1 }, { messageId: "directive", line: 2 }],
    },
  ],
});
