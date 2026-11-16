# clean-code-book/jsdoc-names-every-parameter

A doc comment names every parameter: in its description as a code span, or with an `@param` tag that describes it.

- **Config:** `jsdoc`
- **Fix:** no
- **Catalog entry:** DOC-05 in [`docs/catalog-jsdoc.md`](../../catalog-jsdoc.md)

## What the book says

> "If you are writing a public API, then you should certainly write good document comments for it. But keep in mind the rest of the advice in this chapter. Document comments can be just as misleading, nonlocal, and dishonest as any other kind of comment."

*Clean Code, 2nd Edition*, chapter 5 Comments, § Javadocs (and Their Ilk) in Public APIs (bookCTX `clean-code-a-handbook-of-agile-software-craftsmanship-second-edition` chunk 9).

A doc comment that says what a function does but skips one of its parameters is incomplete: the reader of the editor's hover, or of the generated documentation, cannot tell what to pass, and nothing shows that the comment left it out. The same chapter, in § Redundancy and Imprecision, is just as hard on the opposite mistake, a tag that repeats what is already said: "The redundancy is painful. The variable name says more than the comment." (chunk 10). So the rule asks for each parameter to be named once, where it reads best: in the description, when the sentence already says what it is for, or in an `@param` tag that describes it.

## What it reports

A function that has a `/** */` doc comment, where a parameter is named neither

- in the comment's text as a Markdown code span holding exactly its name, such as `` `first` ``, anywhere in the description or in a tag's text, nor
- by an `@param` tag (or `@arg`, `@argument`) with a description after the name. `@param first` with nothing after it does not count.

A plain word does not name a parameter: in "the lines from first to last", the word `first` may be the parameter or may be English, and a reader cannot tell. Write `` `first` ``. A code span that holds more than the name, such as `` `first.length` ``, does not name it either.

The doc comment is the `/** */` comment directly before the function, with no other comment between: before a function declaration, a class or object method, a constructor, a class field that holds a function, a TypeScript `declare function`, overload signature or interface method signature; before the `export`, `export default` or `const` statement that declares the function (`export const f = () => …`); or before the statement that assigns it (`module.exports.f = function …`). Each overload signature with its own doc comment is checked against its own parameters.

Parameters:

- a default (`last = first`) and a rest parameter (`...items`) are named by their inner name (`` `...items` `` also names `items`), and a TypeScript parameter property (`private readonly owner`) by its name;
- a destructured parameter (`{ computed, optional }`, `[a, b]`) is named when every name it binds is named, or when an `@param` tag whose name is not one of the function's parameter names documents it as a whole, as JSDoc writes it (`@param options …`, `@param root0 …`); such tags are matched to the destructured parameters in order. Otherwise each unnamed name it binds is reported.

It does not report:

- a function with no doc comment: this rule does not ask for doc comments, only that the ones written are complete;
- a parameter whose name starts with `_`, which is unused on purpose (TS-09);
- TypeScript's `this` parameter, which is not passed as an argument.

## Examples

Incorrect:

```ts
/** The lines of the file from `first` on. */
function between(first: number, last: number) {}

/** The lines from first to last. */
function between(first: number, last: number) {}

/**
 * The lines of the file.
 * @param first
 */
function from(first: number) {}

/** Whether `computed` keys are read. */
function reads({ computed, optional }: Keys) {}
```

Correct:

```ts
/** The lines of the file from `first` to `last`. */
function between(first: number, last: number) {}

/**
 * The lines of the file.
 * @param first the first line kept, counting from 1
 */
function from(first: number) {}

/**
 * Reads the keys.
 * @param options which keys to read
 */
function reads({ computed, optional }: Keys) {}
```

## Why there is no autofix

A fix would have to write what the parameter is for, and only the author knows that. An `@param first` with no description, or a sentence that only repeats the name, would silence the rule while adding the noise the book warns of.
