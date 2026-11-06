import { runRuleTests } from "../testing/run-rule-tests.ts";
import rule from "./no-shared-test-state.ts";

const filename = "file.test.ts";

runRuleTests("no-shared-test-state", rule, {
  valid: [
    { name: "state declared inside the test", code: "it('counts', () => { let count = 0; count += 1; count++; expect(count).toBe(2); });", filename },
    {
      name: "state set in `beforeEach`",
      code: "describe('cart', () => {\n  let cart;\n  beforeEach(() => { cart = new Cart(); });\n  it('adds', () => { cart.add(item); expect(cart.size).toBe(1); });\n});",
      filename,
    },
    { name: "state cleared in `afterEach`", code: "let server;\nafterEach(() => { server = undefined; });", filename },
    {
      name: "a variable a hook resets for every test may be written by a test",
      code: "let count = 0;\nbeforeEach(() => { count = 0; });\nit('counts', () => { count++; expect(count).toBe(1); });",
      filename,
    },
    { name: "a write to a property is not an assignment to a variable", code: "const state = { n: 0 };\nit('counts', () => { state.n = 1; process.env.TZ = 'UTC'; });", filename },
    { name: "a variable declared in a nested function of the test", code: "it('loads', async () => { let result; await load().then((r) => { result = r; }); expect(result).toBe(1); });", filename },
    { name: "a loop variable declared in the test", code: "it('sums', () => { let total = 0; for (const n of [1, 2]) total += n; for (let i = 0; i < 2; i++) {} expect(total).toBe(3); });", filename },
    { name: "a `describe` body is setup, not a test", code: "describe('cart', () => { let cart; cart = new Cart(); it('adds', () => { expect(cart).toBeDefined(); }); });", filename },
    { name: "assignments outside any test", code: "let shared = 0;\nshared = 1;\nfunction helper() { shared += 1; }", filename },
    { name: "a `beforeAll` hook is not a test", code: "let db;\nbeforeAll(async () => { db = await connect(); });", filename },
    { name: "an undeclared global cannot be traced to a declaration", code: "it('sets', () => { undeclaredGlobal = 1; });", filename, sourceType: "script" },
    { name: "a parameter of the test callback", code: "test('subtest', (t) => { t = null; });", filename },
  ],
  invalid: [
    {
      name: "a test assigns a variable of its `describe`",
      code: "describe('cart', () => {\n  let cart;\n  it('creates', () => { cart = new Cart(); });\n  it('adds', () => { cart.add(item); });\n});",
      filename,
      errors: [{ messageId: "sharedState", data: { name: "cart" }, line: 3, column: 25 }],
      output: null,
    },
    { name: "a module-level counter incremented", code: "let calls = 0;\ntest('calls', () => { calls++; });", filename, errors: [{ messageId: "sharedState", data: { name: "calls" } }], output: null },
    { name: "a compound assignment", code: "let total = 0;\nit('adds', () => { total += 2; });", filename, errors: [{ messageId: "sharedState", data: { name: "total" } }], output: null },
    {
      name: "a destructuring assignment names each variable",
      code: "let first, rest;\nit('splits', () => { [first, ...rest] = [1, 2, 3]; });",
      filename,
      errors: [{ messageId: "sharedState", data: { name: "first" } }, { messageId: "sharedState", data: { name: "rest" } }],
      output: null,
    },
    { name: "an object destructuring assignment", code: "let user;\nit('loads', () => { ({ user } = load()); });", filename, errors: [{ messageId: "sharedState", data: { name: "user" } }], output: null },
    { name: "a `for…of` loop over an outer variable", code: "let last;\nit('walks', () => { for (last of [1, 2]) {} });", filename, errors: [{ messageId: "sharedState", data: { name: "last" } }], output: null },
    {
      name: "an assignment in a nested callback of the test",
      code: "let result;\nit('loads', async () => { await load().then((r) => { result = r; }); });",
      filename,
      errors: [{ messageId: "sharedState", data: { name: "result" } }],
      output: null,
    },
    { name: "a skipped or focused test is still a test", code: "let n;\nit.skip('a', () => { n = 1; });\ntest.only('b', () => { n = 2; });", filename, errors: 2, output: null },
    { name: "a `node:test` call with options", code: "let n;\ntest('a', { timeout: 10 }, () => { n = 1; });", filename, errors: [{ messageId: "sharedState" }], output: null },
    { name: "a table test", code: "let n;\nit.each([1, 2])('sets %i', (value) => { n = value; });", filename, errors: [{ messageId: "sharedState" }], output: null },
    {
      name: "a reset in `beforeAll` happens once, not for every test",
      code: "let db;\nbeforeAll(() => { db = connect(); });\nit('closes', () => { db = null; });",
      filename,
      errors: [{ messageId: "sharedState", data: { name: "db" }, line: 3 }],
      output: null,
    },
    {
      name: "a hook that only resets a variable of its own does not reset the outer one",
      code: "let n;\nbeforeEach(() => { let n; n = 0; });\nit('sets', () => { n = 1; });",
      filename,
      errors: [{ messageId: "sharedState", line: 3 }],
      output: null,
    },
    { name: "a non-null assertion target", code: "let n: number | undefined;\nit('sets', () => { n! = 1; });", filename, errors: [{ messageId: "sharedState" }], output: null },
    { name: "in JavaScript", code: "var count = 0;\nit('counts', function () { count = count + 1; });", filename: "file.spec.js", errors: [{ messageId: "sharedState" }], output: null },
  ],
});
