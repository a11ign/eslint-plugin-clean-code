import { runRuleTests } from "../../testing/run-rule-tests.ts";
import rule from "./ai-no-emoji.ts";

runRuleTests("ai-no-emoji", rule, {
  valid: [
    { name: "arrows and check marks are not emoji", code: "logger.info(\"Step 1 → Step 2 ✓\");" },
    { name: "©, ™ and ↔ without U+FE0F show as text", code: "const notice = \"© 2024 Acme™ ↔ ✔\";" },
    { name: "JSX text is not checked by default", code: "export const Welcome = () => <h1>🎉 Welcome</h1>;", filename: "file.tsx" },
    { name: "an allowed emoji", code: "const done = \"✅\";", options: [{ allow: ["✅"] }] },
    { name: "an allowed emoji written with U+FE0F in the option", code: "const warn = \"⚠️\";", options: [{ allow: ["⚠"] }] },
    { name: "an escaped emoji is not a literal emoji in the source", code: "const rocket = \"\\u{1F680}\";" },
    { name: "a regex is not a string", code: "const any = /🚀/u;" },
  ],
  invalid: [
    {
      name: "each emoji in a log message",
      code: "logger.info(\"✅ Invoices exported 🚀\");",
      output: null,
      errors: [
        { messageId: "emoji", data: { emoji: "✅" }, line: 1, column: 14, endColumn: 15 },
        { messageId: "emoji", data: { emoji: "🚀" }, line: 1, column: 34, endColumn: 36 },
      ],
    },
    { name: "an emoji in a comment", code: "// 🔥 hot path\nrun();", output: null, errors: [{ messageId: "emoji", data: { emoji: "🔥" } }] },
    { name: "an emoji in a doc comment", code: "/** Sends the invoice ✨ */\nexport function send() {}", output: null, errors: 1 },
    { name: "an emoji in a template literal", code: "const m = `done ${count} ✨`;", output: null, errors: 1 },
    { name: "a text symbol asked to show as emoji with U+FE0F", code: "const w = \"⚠️ careful\";", output: null, errors: [{ messageId: "emoji", data: { emoji: "⚠️" } }] },
    { name: "a ZWJ sequence and a skin tone count once each", code: "const a = \"👩‍💻 and 👍🏽\";", output: null, errors: [{ messageId: "emoji", data: { emoji: "👩‍💻" } }, { messageId: "emoji", data: { emoji: "👍🏽" } }] },
    { name: "a flag counts once", code: "const flag = \"🇬🇧\";", output: null, errors: [{ messageId: "emoji", data: { emoji: "🇬🇧" } }] },
    { name: "a keycap", code: "const one = \"1️⃣\";", output: null, errors: [{ messageId: "emoji", data: { emoji: "1️⃣" } }] },
    { name: "an emoji on a later line of a block comment", code: "/*\n * fast 🚀\n */\nrun();", output: null, errors: [{ messageId: "emoji", line: 2, column: 9 }] },
    { name: "JSX text with checkJsxText", code: "export const Welcome = () => <h1>🎉 Welcome</h1>;", filename: "file.tsx", options: [{ checkJsxText: true }], output: null, errors: [{ messageId: "emoji", data: { emoji: "🎉" } }] },
    { name: "a JSX attribute string is a string", code: "export const Logo = () => <img alt=\"🚀\" />;", filename: "file.tsx", output: null, errors: 1 },
  ],
});
