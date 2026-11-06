# clean-code-book/no-encodings

Leave type and scope encodings out of names: no `m_` member prefix, no Hungarian `str`/`sz` prefix, no `I` on interfaces.

- **Config:** `recommended`
- **Fix:** yes (partial)
- **Catalog entry:** NAM-09, NAM-10

## What the book says

> "Prefixing member variables with something like `m_` is another form of type encoding that is no longer necessary. Your classes and functions should be small enough that you don't need such a crutch."

*Clean Code, 2nd Edition*, chapter 4 Meaningful Names § Member Prefixes (bookCTX chunk 8).

> "We do not recommend prefixing interfaces with `I` , because that's just another kind of type encoding."

*Clean Code, 2nd Edition*, chapter 4 Meaningful Names § Interfaces and Implementations (bookCTX chunk 8).

## What it reports

- A name that starts with `m_` (`m_count`).
- A name that starts with the Hungarian prefix `str` or `sz` followed by a capital letter (`strName`, `szTitle`).
- A TypeScript interface whose name is `I`, then a capital letter, then a lower-case letter (`IShape`).

It checks every binding the file declares (variables, parameters, catch parameters, functions, classes, imports, interfaces and the rest) and every class member (fields, methods, accessors, `#private` members and parameter properties).

It does not report:

- a leading `_` (`_unused`): in TypeScript that marks an intentionally unused binding, a different convention;
- `str` followed by a lower-case letter, which is a word (`strokeWidth`, `string`);
- acronyms after an `I`, whose second capital is followed by another capital (`IPAddress`, `IOStream`), and names that start with the word `IFrame` (`IFrameProps`);
- a type alias (`type IShape = …`), which the book's passage does not name;
- object literal keys (`{ m_count: 1 }`), which are data shapes, often someone else's, rather than declarations.

An imported name is reported in the file that imports it without a fix; `import type { IShape }` is not reported, because only the declaring file knows it is an interface.

## Examples

Incorrect:

```ts
interface IShape {
  area(): number;
}

export class Counter {
  #m_count = 0;

  label(strName: string): string {
    return `${strName}: ${this.#m_count}`;
  }
}
```

Correct:

```ts
interface Shape {
  area(): number;
}

export class Counter {
  #count = 0;

  label(name: string): string {
    return `${name}: ${this.#count}`;
  }
}
```

## Fix

The fix drops the prefix, lowercases the first word of the rest the way camel case writes it (`strURL` becomes `url`, `strHTTPHost` becomes `httpHost`, `m_count` becomes `count`), and renames the declaration and every reference, using the scope analysis both linters share. For an interface it drops the `I` (`IShape` becomes `Shape`). It applies only in an ES module file, and only to:

- a local variable (including a non-exported module-level one),
- a parameter that is a plain identifier,
- a `#private` class field, renamed at every `#name` that refers to it,
- an interface that is not exported or imported.

It does not apply, and the rule reports without a fix, when:

- any reference is a shorthand property (`{ m_count }`) or a shorthand destructuring key (`const { m_count } = o`, `({ m_count } = o)`);
- the binding is a function or a class, whose `name` property would change; this includes a `#private` method or accessor, and a variable, parameter or `#private` field that an anonymous function or class is assigned to (`const m_run = () => {}`), because the function takes the binding's name;
- the new name is declared in any scope the binding is visible in (the scope itself, a scope around it or a scope inside it), is referenced from the binding's scope or a scope inside it (including as an undeclared global), or is a standard ECMAScript global or TypeScript utility type (`Promise`, `Record`);
- for a `#private` field, the new `#name` appears anywhere in the class;
- two renames in the file would give the same new name;
- the new name is not a valid binding name (`m_class`) or still carries an encoding (`m_m_x`);
- code in the binding's scope calls `eval`, which can read the name;
- the binding is imported or exported (`export const`, `export { strName }`, `export default`, `export =`);
- the member is a TypeScript `private`, `protected` or public member, or a parameter property: those are ordinary properties at run time, seen by `JSON.stringify` and `Object.keys`;
- the parameter has a default value, is a rest element or is destructured, or the binding is a catch parameter;
- the declaration is in a script file, in a file with no `import` or `export` (which TypeScript treats as a script whose top-level names are global), in a `declare` declaration, a `declare module` or `declare global` block, or a `.d.ts` file.
