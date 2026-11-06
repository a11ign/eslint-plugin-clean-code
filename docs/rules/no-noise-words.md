# clean-code-book/no-noise-words

Leave noise words out of names: `variable`, a suffix that repeats the declared type, and `Manager`, `Processor`, `Data` or `Info` in class names.

- **Config:** `recommended`
- **Fix:** none
- **Catalog entry:** NAM-08, NAM-11

## What the book says

> "Noise words are redundant. The word *variable* should never appear in a variable name. The word *table* should never appear in a table name. How is `NameString` better than `Name` ?"

*Clean Code, 2nd Edition*, chapter 4 Meaningful Names § Make Meaningful Distinctions (bookCTX chunk 8).

> "Avoid noise words like `Manager` , `Processor` , `Data` , or `Info` in the name of a class. We already know that classes manage and process data and info-you don't need to tell us."

*Clean Code, 2nd Edition*, chapter 4 Meaningful Names § Use Appropriate Parts of Speech (Class Names) (bookCTX chunk 8).

## What it reports

- A variable, parameter, catch parameter or property (class field, interface property, parameter property or object literal property) whose name has the camel-case or snake-case word `variable` (`myVariable`, `ENV_VARIABLE`).
- A variable, parameter or property whose name ends in the word `String` or `Object` when its type annotation is that type: `string` or `String` for `String`, `object` or `Object` for `Object` (`nameString: string`).
- A class whose name has `Manager`, `Processor`, `Data` or `Info` as a separate camel-case or snake-case word (`UserManager`, `CustomerData`, `HTTP_Info_Cache`).

It does not report:

- the word *table*: the book means database tables, which have no syntax here;
- other words that contain these letters: `variables`, `invariable`, `Database`, `Metadata`, `Information`;
- a suffix with no annotation, or an annotation of another type (`nameString` alone, `idObject: number`): without the type, the word may mean something else;
- a name that is only the type's word (`string: string`), which has nothing to drop;
- function names, methods, imported names and destructuring keys, which name something declared elsewhere.

## Examples

Incorrect:

```ts
class CustomerManager {
  nameString: string = "";

  rename(newNameVariable: string): void {
    this.nameString = newNameVariable;
  }
}
```

Correct:

```ts
class Customers {
  name: string = "";

  rename(name: string): void {
    this.name = name;
  }
}
```

## Why there is no autofix

Removing the word can leave an empty or colliding name (`DataManager` without both words is empty, `nameString` without its suffix may collide with `name`), and a better name needs to know what the value or class means.
