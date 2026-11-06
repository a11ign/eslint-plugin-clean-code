# clean-code-book/no-flag-argument

Don't pass a boolean flag into a function: it says the function does more than one thing.

- **Config:** `recommended`
- **Fix:** partial
- **Catalog entry:** FH-01

## What the book says

> "Flag arguments are ugly. Passing a `boolean` into a function is generally careless. It immediately complicates the signature of the function, and loudly proclaims that the function does more than one thing."

*Clean Code, 2nd Edition*, chapter 8 Function Heuristics § Flag Arguments (bookCTX chunk 13).

## What it reports

A parameter of a function or method that is declared with a `boolean` type annotation (`verbose: boolean`, `verbose?: boolean`) or has a boolean default value (`verbose = false`).

It does not report:

- the book's own exception, a method named `set` followed by an uppercase letter whose last parameter is the boolean: "some objects have binary flags within them that are set with a `setFlag(boolean)` method. I'm not going to complain about them."
- a `set` accessor, which is called by assignment, not with an argument.
- a method that returns `this`, a fluent setter (`withDebug(debug: boolean) { …; return this; }`), also behind a type-only wrapper: `this as this`, `this satisfies Builder`, `this!`, `<this>this`.
- a function written directly as a call argument or a JSX attribute (`items.forEach((item, skip: boolean) => …)`, `onToggle={(open: boolean) => …}`), a method with the `override` modifier, and a method of a class that `implements` an interface. Someone else sets their signatures.
- a parameter that is already a destructured options object (`{ verbose = false }: Options = {}`), whose booleans are named at the call site.
- overload signatures and interface members on their own. An overloaded function is reported once, at its implementation.

## Examples

Incorrect:

```ts
function monthNames(long: boolean): string[] {
  return long ? ["January", "February"] : ["Jan", "Feb"];
}

monthNames(true);
```

Correct, the book's remedy:

```ts
function longMonthNames(): string[] {
  return ["January", "February"];
}

function shortMonthNames(): string[] {
  return ["Jan", "Feb"];
}
```

Also correct, what the fix writes:

```ts
function monthNames({ long }: { long: boolean }): string[] {
  return long ? ["January", "February"] : ["Jan", "Feb"];
}

monthNames({ long: true });
```

## Fix

The book's remedy is to split the function in two, which needs two new names, so the message suggests it and the fix does something else: it turns the boolean into a property of an options object, the keyword-parameter remedy of NAM-22.

- `(name, verbose = false)` becomes `(name, { verbose = false } = {})`.
- `(name, verbose?: boolean)` becomes `(name, { verbose }: { verbose?: boolean } = {})`, so a call that leaves the argument out still gets `undefined`.
- A required flag, `(name, verbose: boolean)`, becomes `(name, { verbose }: { verbose: boolean })`, with no `= {}`, so `verbose` is still a `boolean` in the body and the code still type-checks. This form is used only when every call passes the argument, since a call that left it out would throw on destructuring `undefined`.
- Every call in the file, `f(x, true)`, becomes `f(x, { verbose: true })`. A call that leaves the argument out is unchanged. An argument with the flag's own name becomes `{ verbose }`, and a sequence expression keeps its parentheses.
- In TypeScript, the overload signatures are rewritten in the same fix: `verbose: boolean` becomes `options: { verbose: boolean }`, and `verbose?: boolean` becomes `options?: { verbose?: boolean }`. A signature names the object instead of destructuring it, because an optional binding pattern does not type-check in a signature. Every signature and the implementation stay.

The function then receives the same value as before for every call: `true`, `false`, any other value, and `undefined` when the argument is left out (for an optional flag) or passed as `undefined`, which still takes the default.

The fix does not apply, and the rule reports without fixing, when:

- the file is not an ES module, or has no `import` or `export`, because it may be a classic script whose top-level functions are globals that other scripts call;
- a required flag (`verbose: boolean`) is left out by a call;
- another declaration in the same scope has the function's name (a second function declaration, or a merged `namespace`), so a call may reach a declaration the fix did not rewrite;
- the file has a direct `eval(…)` call, which can read `arguments` or call the function with a boolean where the fix cannot see it;
- the function is a method, because an override in another file would still receive a boolean;
- the function is not a function declaration or a `const` function (a `let` or `var` can be reassigned);
- the function is exported, where it is declared or by name (`export { f }`, `export default f`), because its callers in other files cannot be seen;
- the boolean is not the last parameter, or the function has a TypeScript `this` parameter;
- the function uses `arguments`, which would see an object instead of a boolean;
- a reference to the function is anything other than a direct call: passed as a value (`[1, 2].map(f)`), called with `new`, used as a tag, or named in a type (`typeof f`);
- a call passes a spread argument, which hides where the flag lands;
- the body starts with a `"use strict"` directive, which a destructured parameter makes a syntax error;
- an overload signature's flag parameter is not a plain name with a type annotation.

A method, an exported function and a function passed as a value are still reported after `--fix`, because no fix can see their callers in other files.
