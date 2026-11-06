import { runRuleTests } from "../testing/run-rule-tests.ts";
import rule from "./no-disabled-tests.ts";

const filename = "file.test.ts";

runRuleTests("no-disabled-tests", rule, {
  valid: [
    { name: "a running test", code: "it('adds', () => { expect(add(1, 2)).toBe(3); });", filename },
    { name: "a focused test and group", code: "describe.only('math', () => { test.only('adds', () => {}); });", filename },
    { name: "a to-do is not a disabled test", code: "it.todo('handles overflow'); test.todo('handles underflow');", filename },
    {
      name: "a comment directly above gives the reason",
      code: "// Takes too long to run; runs in the nightly suite instead.\nit.skip('imports the full catalogue', () => {});",
      filename,
    },
    {
      name: "a block comment above an `x` form gives the reason",
      code: "/* Waiting for the tax table of 2027 (#412). */\nxdescribe('tax 2027', () => {});",
      filename,
    },
    {
      name: "a reason comment above a directive",
      code: "// Flaky on Windows until the file watcher is replaced.\n// eslint-disable-next-line no-console\ntest.skip('watches files', () => {});",
      filename,
    },
    {
      name: "a reason above an awaited `node:test` call",
      code: "// The sandbox has no network.\nawait test('fetches', { skip: true }, async () => {});",
      filename,
    },
    {
      name: "`node:test` skip with a message carries its reason",
      code: "test('fetches', { skip: 'the sandbox has no network' }, async () => {});",
      filename,
    },
    { name: "`skip: false` runs the test", code: "it('adds', { skip: false }, () => {});", filename },
    { name: "a skip decided at run time is not a disabled test", code: "it('adds', { skip: process.platform === 'win32' }, () => {});", filename },
    { name: "Vitest's conditional skip is not a disabled test", code: "it.skipIf(isWindows)('watches files', () => {});", filename },
    { name: "a `skip` method on something else", code: "parser.skip(); list.skip(2); steps.it.skip();", filename },
    { name: "a computed `skip` is not read", code: "it['skip']('adds', () => {});", filename },
  ],
  invalid: [
    { name: "it.skip", code: "it.skip('adds', () => {});", filename, errors: [{ messageId: "disabled", data: { form: "it.skip", what: "test" }, column: 4 }], output: null },
    { name: "test.skip", code: "test.skip('adds', () => {});", filename, errors: [{ messageId: "disabled", data: { form: "test.skip", what: "test" } }], output: null },
    {
      name: "describe.skip",
      code: "describe.skip('math', () => {});",
      filename,
      errors: [{ messageId: "disabled", data: { form: "describe.skip", what: "group of tests" } }],
      output: null,
    },
    { name: "xit", code: "xit('adds', () => {});", filename, errors: [{ messageId: "disabled", data: { form: "xit", what: "test" }, column: 1 }], output: null },
    { name: "xtest", code: "xtest('adds', () => {});", filename, errors: [{ messageId: "disabled", data: { form: "xtest", what: "test" } }], output: null },
    { name: "xdescribe", code: "xdescribe('math', () => {});", filename, errors: [{ messageId: "disabled", data: { form: "xdescribe", what: "group of tests" } }], output: null },
    {
      name: "`node:test`'s skip option",
      code: "test('adds', { skip: true }, () => {});",
      filename,
      errors: [{ messageId: "disabled", data: { form: "skip: true", what: "test" }, column: 16 }],
      output: null,
    },
    { name: "a skip option with a quoted key", code: "describe('math', { 'skip': true }, () => {});", filename, errors: [{ messageId: "disabled", data: { form: "skip: true", what: "group of tests" } }], output: null },
    { name: "skip after another modifier", code: "test.concurrent.skip('adds', async () => {});", filename, errors: [{ messageId: "disabled", data: { form: "test.skip", what: "test" } }], output: null },
    { name: "a skipped table test", code: "it.skip.each([[1, 2]])('adds %i', (a, b) => {});", filename, errors: [{ messageId: "disabled", data: { form: "it.skip", what: "test" } }], output: null },
    { name: "a nested skipped test", code: "describe('math', () => {\n  it('adds', () => {});\n  it.skip('subtracts', () => {});\n});", filename, errors: [{ messageId: "disabled", line: 3 }], output: null },
    {
      name: "a blank line separates the comment from the call",
      code: "// Takes too long to run.\n\nit.skip('imports', () => {});",
      filename,
      errors: [{ messageId: "disabled" }],
      output: null,
    },
    {
      name: "a directive alone is not a reason",
      code: "// eslint-disable-next-line no-console\nit.skip('imports', () => {});",
      filename,
      errors: [{ messageId: "disabled" }],
      output: null,
    },
    { name: "a comment with no words is not a reason", code: "// ---\nxit('imports', () => {});", filename, errors: [{ messageId: "disabled" }], output: null },
    { name: "a comment after the call is not before it", code: "it.skip('imports', () => {}); // Takes too long to run.", filename, errors: [{ messageId: "disabled" }], output: null },
    {
      name: "the comment above one call does not cover the next",
      code: "// Takes too long to run.\nit.skip('imports', () => {});\nit.skip('exports', () => {});",
      filename,
      errors: [{ messageId: "disabled", line: 3 }],
      output: null,
    },
    { name: "in JavaScript", code: "xit('adds', function () {});", filename: "file.spec.js", errors: [{ messageId: "disabled" }], output: null },
  ],
});
