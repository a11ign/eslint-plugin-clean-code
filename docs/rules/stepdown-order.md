# clean-code-book/stepdown-order

Declare a function below the first function that calls it, so the code reads top to bottom (the Stepdown Rule).

- **Config:** `recommended`
- **Fix:** yes, for function declarations (partial)
- **Catalog entry:** FMT-04

## What the book says

> "I like to organize my extracted functions in the order that they are called. So, when one function calls another, all you have to do is scroll down to see the called function-right there. If function A calls B and C, then their order in the source file should be A, B, C."

*Clean Code, 2nd Edition*, chapter 10 One Thing § 4. Bouncing Around (bookCTX chunk 17). The same rule is in chapter 6 Formatting § Dependent Functions (chunk 11) and chapter 7 Clean Functions § Reading Code from Top to Bottom: The Stepdown Rule (chunk 12).

## What it reports

- A function declaration that is declared above the first function in the same list of statements that uses it. The callers counted are the other function declarations in that list, and the `const f = () => …` and `const f = function () {…}` functions in it. A function declared inside a caller counts as part of that caller.
- A class method that is declared above the first member of its class that calls it, through `this.name()`, `this.#name()` or, for a static method, `ClassName.name()`. `this` inside a nested `function` is not the instance, so a call there is not counted.

It does not report:

- a `const f = () => …` that is declared above its caller. Moving it below the caller can put a call inside its temporal dead zone, so it is never checked.
- recursion, or mutual recursion: a caller that the function itself calls, directly or through other functions, does not count.
- a function that only top-level code, or code that is not a function, calls. A function declared after a `return` and called before it is not reported.
- getters, setters and constructors, which are not methods called by name.

This order conflicts with core `no-use-before-define` unless that rule runs with `functions: false`.

## Examples

Incorrect:

```ts
function formatTotal(total: number): string {
  return `${total.toFixed(2)} EUR`;
}

export function renderInvoice(lines: number[]): string {
  return formatTotal(lines.reduce((sum, line) => sum + line, 0));
}
```

Correct:

```ts
export function renderInvoice(lines: number[]): string {
  return formatTotal(lines.reduce((sum, line) => sum + line, 0));
}

function formatTotal(total: number): string {
  return `${total.toFixed(2)} EUR`;
}
```

## Fix

The fix moves the reported function declaration to the line after its first caller, with the comments attached to it: the comments directly above it, with no blank line between, and a comment after it on its last line. A directive that covers the next line (`eslint-disable-next-line`, `@ts-expect-error`) moves with it; a directive that covers a region (`eslint-disable`, `#region`) stays where it is. A TypeScript overload group, its signatures and its implementation, moves as one block. A function declaration is bound before any code in its scope runs, so the move changes nothing at runtime.

The removal follows the catalog's "How fixes stay safe": in code without semicolons, when the line after the function starts with `(`, `[`, `` ` ``, `+`, `-`, `/` or `*`, it gets a `;`, and a line that already starts with `;` keeps it.

The fix settles the whole list of statements at once. It works out the order the list reaches when each misplaced function moves to just after its first caller, again and again until none is misplaced, and makes all those moves in one fix. So a chain such as `leaf`, `middle` (calls `leaf`), `main` (calls `middle`) becomes `main`, `middle`, `leaf` in a single `--fix` pass, and the fixed code is not reported again. A function that was in order can move too, when its only caller above it moves below it. Statements that are not moved keep their order.

There is no fix, and the rule only reports, when:

- the code may be sloppy-mode script code: the file has no `import` or `export` (so it may be run as a script) and no `"use strict"`. There, a function declared in a block is bound when the block runs, so moving it changes what runs.
- the declaration is not directly in a function body or the module body: in a block, a `switch`, a `static {}` block or a namespace.
- another declaration in the scope has the same name (a `var`, a parameter, another function), since the last one wins.
- the function has decorators. No syntax allows decorators on a function declaration today, so this condition is there for a future one.
- the function shares a line with other code, or other code follows the caller on its last line, so the function cannot be moved as whole lines.
- a directive comment lies between the function's old place and its new one (`/* eslint-disable */`, `// c8 ignore start`, `/* istanbul ignore next */`), so the move would take the function into or out of what the directive covers; or the function holds a region directive (`/* eslint-disable */`, `// c8 ignore start`), which could then cover different code.
- the list does not settle (a safety limit on the number of moves), or a function the list needs to move cannot be inserted on lines of its own. Then no function in that list is fixed.
- the function is a class method. Moving a method changes the order of `Object.getOwnPropertyNames(C.prototype)`, which code can observe, and a computed method key is evaluated in source order.
