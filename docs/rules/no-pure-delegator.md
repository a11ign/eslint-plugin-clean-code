# clean-code-book/no-pure-delegator

Don't extract the whole body of a function into another one, leaving a function that only passes its parameters on.

- **Config:** `recommended`
- **Fix:** partial
- **Catalog entry:** ONE-02

## What the book says

> "There is no point in extracting the entire body of a function, leaving behind a pure delegator. Such an extraction is not meaningful."

*Clean Code, 2nd Edition*, chapter 10 One Thing § Extract Method Refactoring (bookCTX chunks 17, 41).

## What it reports

A function declaration that is not exported and whose whole body is `return g(p1, …, pn)` or `g(p1, …, pn);`: it passes its own parameters to `g`, unchanged and in order, where `g` is a function declared in the same file (a function declaration or a `const` function). A rest parameter passed on as a spread (`(...a) => g(...a)`) counts as passed unchanged.

It does not report:

- a method: a method that forwards a request is how an object hides its collaborator ("Tell the Other Guy", OBJ-07);
- an exported function, where it is declared or by name: the book's footnote allows a delegator "so that you can move the extracted function to a new module";
- a call to an imported function, a parameter, a member (`api.g(a)`), or an optional call (`g?.(a)`);
- a body that changes, reorders, leaves out or adds an argument, or does anything else.

## Examples

Incorrect:

```ts
function render(page: Page): string {
  return renderPage(page);
}

function renderPage(page: Page): string {
  return `<h1>${page.title}</h1>`;
}

render(home);
```

Correct:

```ts
function render(page: Page): string {
  return `<h1>${page.title}</h1>`;
}

render(home);
```

## Fix

The fix replaces each call of the delegator with a call of `g` and removes the delegator, with the doc comment directly above it. The removal follows "How fixes stay safe": in code without semicolons, a `;` that starts the next line is kept, and one is added when the next line would otherwise continue the statement before the delegator.

The fix does not apply, and the rule reports without fixing, when:

- the delegator is `async` or a generator, since the result type would change;
- a parameter has a default, is destructured or is a rest parameter, or a parameter is named `arguments` or is a TypeScript `this` parameter;
- a reference is not a direct call that passes exactly as many arguments as the delegator declares: a call with fewer or more arguments (which would change what `g` sees in `arguments` or a rest parameter), a spread argument, `new`, a tagged template, or the delegator passed as a value;
- the delegator has no `return` and a call's result is used;
- `g` is not visible, or means another binding, at a call site;
- `g` is not a function declaration, or is reassigned. A `const` function is not hoisted, so calling it before its declaration would throw before the arguments are evaluated instead of after;
- the delegator or its call has type parameters or type arguments;
- the delegator is overloaded;
- the delegator is a top-level function of a script, which other scripts may call, or the file has no `import` or `export`, so it may be a classic script;
- the delegator's parameters have type annotations and a call passes an arrow function, a function expression, an object literal or an array literal (also as a branch of `?:`, `&&`, `||` or `??`). Such an argument takes its type from the delegator's parameter, and passed to `g` it would be typed by `g`'s parameter instead, which can fail to type-check (an arrow's parameter becomes an implicit `any`, TS7006);
- another declaration in the same scope has the delegator's name, so a call may reach it instead;
- the file has a direct `eval(…)` call, which could call the delegator by name;
- a directive comment (`eslint-disable`, `@ts-…` and the rest) is inside the delegator or directly above it.

The delegator cannot use `this` or `arguments`: its body is one call whose callee and arguments are plain names.
