# clean-code-book/no-command-query-mix

A function used as a condition either answers something or does something, not both.

- **Config:** `recommended`; `recommended-type-checked` with `checkMethodCalls: true`
- **Fix:** none
- **Catalog entry:** FH-04

## What the book says

> "Under the CQS convention, functions either do something or answer something, but not both. Either a function is a command that creates a side effect (i.e., it changes the state of the system), or it is a query that returns some information."

*Clean Code, 2nd Edition*, chapter 8 Function Heuristics § Command Query Separation (bookCTX chunk 13).

## What it reports

A call used as the test of an `if`, a `while` or a ternary (directly, or under `!`, `?.` or a type assertion), when the function called both:

- writes state outside itself: an assignment or `++`/`--` to a member of `this`, to a member of a parameter or of an outer variable, or to an outer variable, anywhere in its body including callbacks, and
- returns a boolean literal or a comparison (`===`, `<`, `in`, `instanceof` and the rest) on some path.

That is the book's own example, `if (set("username", "unclebob"))`. The rule checks only calls whose function it can see:

- a function declared in the same file, by a function declaration or a variable initialised with a function;
- `this.method()` for a method of the enclosing class (a static method from a static one);
- with `checkMethodCalls: true` and type information, `obj.method()`, resolved through the type of `obj` to a method declared in the file being linted.

It does not report:

- getters, fluent setters (which return `this`) and a getOrCreate (which returns the value, not a boolean);
- library calls such as `Map.prototype.delete` and `Set.prototype.add`, whose bodies it cannot see. Matching by name alone would confuse a project method `set()` with `Map.prototype.set`, so a method call on another object is resolved only through its type;
- imported functions, and, with `checkMethodCalls`, methods declared in another file: the rule analyses the syntax tree of the file being linted, and has none for other files;
- a function that changes only its own local variables, or members of objects it created;
- a call that is only part of a larger condition (`set(a, b) && ready`).

## Examples

Incorrect:

```ts
function set(attribute: string, value: string): boolean {
  if (attribute in attributes) return false;
  attributes[attribute] = value;
  return true;
}

if (set("username", "unclebob")) {
  // …
}
```

Correct:

```ts
if (attributeExists("username")) {
  setAttribute("username", "unclebob");
}
```

## Options

- `checkMethodCalls` (boolean, default `false`): also resolve `obj.method()` through the type of `obj`. It needs type information (`parserOptions.projectService`); without it, the option does nothing and the rule still checks the calls it can resolve from syntax. `recommended-type-checked` turns it on.

## Why there is no autofix

Splitting the function into a query and a command needs two names. The book also treats CQS as a convention it breaks "only after considering the possible outcomes", for example an atomic `pop`.
