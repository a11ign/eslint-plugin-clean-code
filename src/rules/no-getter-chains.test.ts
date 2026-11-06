import { runRuleTests } from "../testing/run-rule-tests.ts";
import rule from "./no-getter-chains.ts";

runRuleTests("no-getter-chains", rule, {
  valid: [
    "const dir = ctxt.getOptions();",
    {
      name: "field access is how a data structure is read",
      code: "const outputDir = ctxt.options.scratchDir.absolutePath;",
    },
    {
      name: "regression: getOrCreate is not a getter",
      code: "registry.getOrCreate(key).getName();",
    },
    {
      name: "regression: a call with arguments is not a getter",
      code: "document.getSelection().getRangeAt(0);",
    },
    "map.getOrDefault(k, d).getValue();",
    "map.getOrThrow().getValue();",
    "a.getB(1).getC();",
    {
      name: "a non-getter call breaks the chain",
      code: "ctxt.getOptions().scratch().getDir();",
    },
    {
      name: "a property between the getter calls breaks the chain",
      code: "ctxt.getOptions().scratchDir.getPath();",
    },
    "a.get().getB();",
    "a.getaway().getB();",
    "getOptions().getDir;",
    "a.getB()[\"getC\"]();",
    {
      name: "a higher threshold",
      code: "ctxt.getOptions().getScratchDir();",
      options: [{ chainLength: 3 }],
    },
  ],
  invalid: [
    {
      name: "the book's trainwreck is reported once, at the end of the chain",
      code: "const outputDir = ctxt.getOptions().getScratchDir().getAbsolutePath();",
      errors: [{ messageId: "getterChain", data: { chain: "getOptions().getScratchDir().getAbsolutePath()", count: "3" } }],
      output: null,
    },
    {
      name: "two chained getter calls",
      code: "ctxt.getOptions().getScratchDir();",
      errors: [{ messageId: "getterChain", data: { chain: "getOptions().getScratchDir()", count: "2" } }],
      output: null,
    },
    {
      name: "getOrder is a getter: only getOr followed by an uppercase letter is excluded",
      code: "invoice.getOrder().getTotal();",
      errors: 1,
      output: null,
    },
    {
      name: "optional chaining and non-null assertions do not break the chain",
      code: "a?.getB()?.getC();\na.getB()!.getC();",
      errors: [{ messageId: "getterChain", line: 1 }, { messageId: "getterChain", line: 2 }],
      output: null,
    },
    {
      name: "a getter chain made on the result of another call",
      code: "load().getConfig().getName();",
      errors: [{ messageId: "getterChain", data: { chain: "getConfig().getName()", count: "2" } }],
      output: null,
    },
    {
      name: "the threshold of three",
      code: "ctxt.getOptions().getScratchDir().getAbsolutePath();",
      options: [{ chainLength: 3 }],
      errors: 1,
      output: null,
    },
  ],
});
