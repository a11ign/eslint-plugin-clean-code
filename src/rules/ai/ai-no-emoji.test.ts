import { runRuleTests } from "../../testing/run-rule-tests.ts";
import rule from "./ai-no-emoji.ts";

runRuleTests("ai-no-emoji", rule, {
  valid: [
    { name: "arrows and check marks are not emoji", code: "logger.info(\"Step 1 → Step 2 ✓\");" },
    { name: "©, ™ and ↔ without U+FE0F show as text", code: "const notice = \"© 2024 Acme™ ↔ ✔\";" },
    { name: "JSX text is not checked by default", code: "export const Welcome = () => <h1>\u{1F389} Welcome</h1>;", filename: "file.tsx" },
    { name: "an allowed emoji", code: "const done = \"\u{2705}\";", options: [{ allow: ["\u{2705}"] }] },
    { name: "an allowed emoji written with U+FE0F in the option", code: "const warn = \"\u{26A0}\u{FE0F}\";", options: [{ allow: ["⚠"] }] },
    { name: "an escaped emoji is not a literal emoji in the source", code: "const rocket = \"\\u{1F680}\";" },
    { name: "a regex is not a string", code: "const any = /\u{1F680}/u;" },
  ],
  invalid: [
    {
      name: "each emoji in a log message",
      code: "logger.info(\"\u{2705} Invoices exported \u{1F680}\");",
      output: null,
      errors: [
        { messageId: "emoji", data: { emoji: "\u{2705}" }, line: 1, column: 14, endColumn: 15 },
        { messageId: "emoji", data: { emoji: "\u{1F680}" }, line: 1, column: 34, endColumn: 36 },
      ],
    },
    { name: "an emoji in a comment", code: "// \u{1F525} hot path\nrun();", output: null, errors: [{ messageId: "emoji", data: { emoji: "\u{1F525}" } }] },
    { name: "an emoji in a doc comment", code: "/** Sends the invoice \u{2728} */\nexport function send() {}", output: null, errors: 1 },
    { name: "an emoji in a template literal", code: "const m = `done ${count} \u{2728}`;", output: null, errors: 1 },
    { name: "a text symbol asked to show as emoji with U+FE0F", code: "const w = \"\u{26A0}\u{FE0F} careful\";", output: null, errors: [{ messageId: "emoji", data: { emoji: "\u{26A0}\u{FE0F}" } }] },
    { name: "a ZWJ sequence and a skin tone count once each", code: "const a = \"\u{1F469}\u{200D}\u{1F4BB} and \u{1F44D}\u{1F3FD}\";", output: null, errors: [{ messageId: "emoji", data: { emoji: "\u{1F469}\u{200D}\u{1F4BB}" } }, { messageId: "emoji", data: { emoji: "\u{1F44D}\u{1F3FD}" } }] },
    { name: "a flag counts once", code: "const flag = \"\u{1F1EC}\u{1F1E7}\";", output: null, errors: [{ messageId: "emoji", data: { emoji: "\u{1F1EC}\u{1F1E7}" } }] },
    { name: "a keycap", code: "const one = \"1\u{FE0F}\u{20E3}\";", output: null, errors: [{ messageId: "emoji", data: { emoji: "1\u{FE0F}\u{20E3}" } }] },
    { name: "an emoji on a later line of a block comment", code: "/*\n * fast \u{1F680}\n */\nrun();", output: null, errors: [{ messageId: "emoji", line: 2, column: 9 }] },
    { name: "JSX text with checkJsxText", code: "export const Welcome = () => <h1>\u{1F389} Welcome</h1>;", filename: "file.tsx", options: [{ checkJsxText: true }], output: null, errors: [{ messageId: "emoji", data: { emoji: "\u{1F389}" } }] },
    { name: "a JSX attribute string is a string", code: "export const Logo = () => <img alt=\"\u{1F680}\" />;", filename: "file.tsx", output: null, errors: 1 },
  ],
});
