import { runRuleTests } from "../../testing/run-rule-tests.ts";
import rule from "./ai-no-placeholder-values.ts";

runRuleTests("ai-no-placeholder-values", rule, {
  valid: [
    { name: "a value read from the environment", code: "const apiKey = process.env.API_KEY;" },
    { name: "words that only contain a placeholder word", code: "const hint = \"Type your name here to search\";\nconst label = \"placeholder text\";" },
    { name: "a property key named placeholder", code: "const field = { \"placeholder\": label };\nconst value = input[\"placeholder\"];" },
    { name: "a module specifier", code: "import x from \"placeholder\";\nexport { x };" },
    { name: "a TypeScript literal type", code: "type Kind = \"placeholder\" | \"value\";" },
    { name: "a template literal with an expression", code: "const key = `YOUR_${name}`;" },
    { name: "a real-looking key", code: "const key = \"sk-live-4f9a\";" },
  ],
  invalid: [
    { name: "\"YOUR_API_KEY\"", code: "const apiKey = \"YOUR_API_KEY\";", output: null, errors: [{ messageId: "placeholder", data: { text: "YOUR_API_KEY" } }] },
    { name: "\"<insert token>\"", code: "const token = \"<insert token>\";", output: null, errors: 1 },
    { name: "\"<your email>\" and \"<enter password>\"", code: "login(\"<your email>\", \"<enter password>\");", output: null, errors: 2 },
    { name: "\"your-api-key-here\" and \"your_token_here\"", code: "send(\"your-api-key-here\", \"your_token_here\");", output: null, errors: 2 },
    { name: "replace-me, changeme, xxx and placeholder", code: "f(\"replace-me\", \"REPLACEME\", \"changeme\", \"xxxx\", \"placeholder\");", output: null, errors: 5 },
    { name: "sk-xxx and sk-...", code: "f(\"sk-xxx\", \"sk-...\");", output: null, errors: 2 },
    { name: "a template literal with no expressions", code: "const apiKey = `YOUR_API_KEY`;", output: null, errors: 1 },
    { name: "a JSX attribute value", code: "export const F = () => <input value=\"changeme\" />;", filename: "file.tsx", output: null, errors: 1 },
    { name: "a pattern added through the option", code: "const id = \"TBD\";", options: [{ patterns: ["^tbd$"] }], output: null, errors: 1 },
  ],
});
