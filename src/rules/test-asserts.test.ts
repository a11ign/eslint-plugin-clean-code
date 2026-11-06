import { runRuleTests } from "../testing/run-rule-tests.ts";
import rule from "./test-asserts.ts";

const filename = "file.test.ts";

runRuleTests("test-asserts", rule, {
  valid: [
    { name: "expect", code: "it('adds', () => { expect(add(1, 2)).toBe(3); });", filename },
    { name: "regression: a test whose only assertion is `assert.equal(…)`", code: "import assert from 'node:assert';\ntest('adds', () => {\n  assert.equal(add(1, 2), 3);\n});", filename },
    { name: "a bare `assert(…)` call", code: "test('adds', () => { assert(add(1, 2) === 3); });", filename },
    { name: "`node:assert/strict` through a longer chain", code: "test('adds', () => { assert.strict.deepEqual(add(1, 2), 3); });", filename },
    { name: "a composed assertion", code: "it('taxes the first bracket', () => { assertTaxFor(10_000, 1_000); });", filename },
    { name: "a composed expectation", code: "it('taxes the first bracket', () => { expectTax(10_000).toBe(1_000); });", filename },
    { name: "`node:test`'s `t.assert`", code: "test('adds', (t) => { t.assert.strictEqual(add(1, 2), 3); });", filename },
    { name: "Vitest's context `expect`", code: "test('adds', ({ expect }) => { expect(add(1, 2)).toBe(3); });\ntest('adds', (context) => { context.expect(add(1, 2)).toBe(3); });", filename },
    { name: "`expect.assertions`", code: "it('rejects', async () => { expect.assertions(1); await run(); });", filename },
    { name: "an assertion inside a nested callback", code: "it('maps', async () => { [1, 2].forEach((n) => expect(n).toBeGreaterThan(0)); await waitFor(() => expect(screen.getByText('ok')).toBeVisible()); });", filename },
    { name: "an assertion on a chained call", code: "it('serves', () => request(app).get('/').expect(200));", filename },
    { name: "a `describe` is a group, not a test", code: "describe('math', () => { it('adds', () => { expect(1).toBe(1); }); });", filename },
    { name: "a to-do is not checked", code: "it.todo('handles overflow');\ntest('handles underflow', { todo: true }, () => {});\ntest.todo('later', () => {});", filename },
    {
      name: "a skipped test is not checked",
      code: "it.skip('adds', () => {});\nxit('adds', () => {});\ntest('adds', { skip: true }, () => {});\ntest('adds', { skip: 'no network' }, () => {});",
      filename,
    },
    { name: "a test with no callback is pending, not checked", code: "it('handles overflow');", filename },
    { name: "a callback passed by name cannot be read", code: "it('adds', checkAddition);", filename },
    { name: "a table test that asserts", code: "it.each([[1, 2, 3]])('adds %i and %i', (a, b, sum) => { expect(add(a, b)).toBe(sum); });", filename },
    { name: "a `node:test` subtest's assertion counts for its parent", code: "test('math', async (t) => { await t.test('adds', () => { assert.equal(add(1, 2), 3); }); });", filename },
    {
      name: "a helper named in `assertFunctionNames`",
      code: "it('adds', () => { verifyTotals(cart); });",
      filename,
      options: [{ assertFunctionNames: ["verify*"] }],
    },
    {
      name: "a `**` pattern in `assertFunctionNames`",
      code: "it('serves', () => { api.get('/').should.haveStatus(200); });",
      filename,
      options: [{ assertFunctionNames: ["api.**.haveStatus"] }],
    },
    { name: "calls outside a test are not checked", code: "setup(); helper(() => {});", filename },
  ],
  invalid: [
    { name: "a test that only calls", code: "it('adds', () => { add(1, 2); });", filename, errors: [{ messageId: "noAssertion", line: 1, column: 1 }], output: null },
    { name: "a test that logs", code: "test('adds', () => {\n  console.log(add(1, 2));\n});", filename, errors: [{ messageId: "noAssertion" }], output: null },
    { name: "an empty test", code: "test('adds', async function () {});", filename, errors: [{ messageId: "noAssertion" }], output: null },
    { name: "a focused test is checked", code: "it.only('adds', () => { add(1, 2); });", filename, errors: [{ messageId: "noAssertion" }], output: null },
    { name: "a `node:test` call with options", code: "test('adds', { timeout: 100 }, () => { add(1, 2); });", filename, errors: [{ messageId: "noAssertion" }], output: null },
    { name: "`skip: false` runs, so it is checked", code: "test('adds', { skip: false }, () => { add(1, 2); });", filename, errors: [{ messageId: "noAssertion" }], output: null },
    { name: "a table test", code: "test.each([[1, 2]])('adds %i', (a, b) => { add(a, b); });", filename, errors: [{ messageId: "noAssertion" }], output: null },
    {
      name: "each test is checked on its own",
      code: "describe('math', () => {\n  it('adds', () => { expect(add(1, 2)).toBe(3); });\n  it('subtracts', () => { subtract(2, 1); });\n});",
      filename,
      errors: [{ messageId: "noAssertion", line: 3 }],
      output: null,
    },
    { name: "an assertion before the test does not count", code: "expect(setup()).toBe(true);\nit('adds', () => { add(1, 2); });", filename, errors: [{ messageId: "noAssertion", line: 2 }], output: null },
    { name: "a property that only starts with `assert` is not an assertion", code: "it('validates', () => { user.assertValid; user.expected(); });", filename, errors: [{ messageId: "noAssertion" }], output: null },
    { name: "a helper not named in the option", code: "it('adds', () => { verifyTotals(cart); });", filename, options: [{ assertFunctionNames: ["check*"] }], errors: [{ messageId: "noAssertion" }], output: null },
    { name: "in JavaScript", code: "it('adds', function () { add(1, 2); });", filename: "file.spec.js", errors: [{ messageId: "noAssertion" }], output: null },
  ],
});
