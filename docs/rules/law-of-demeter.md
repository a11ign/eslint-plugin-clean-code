# clean-code-book/law-of-demeter

Do not call methods on objects returned by other method calls: talk to friends, not to strangers.

- **Config:** `recommended-type-checked`
- **Fix:** none
- **Catalog entry:** OBJ-01
- **Type information:** required. The rule reads types through typescript-eslint's `projectService`. Without type information it reports nothing.

## What the book says

> "The method should not invoke methods on objects that are returned by any of the allowed functions. In other words, be shy, talk to friends, and don't talk to strangers."

*Clean Code, 2nd Edition*, chapter 12 Objects and Data Structures § The Law of Demeter (bookCTX chunk 20).

The book's allowed targets for a method *f* of a class *C* are: "*C*", "An object created by *f*", "An object passed as an argument to *f*", "An object held in an instance variable of *C*".

## What it reports

A method call on the result of another method call, `a.b().c()`, when what `b()` returns is an *object* in the book's sense: an instance of a class declared in the project that has methods and non-public state (a `private`, `protected` or `#private` field, or such a parameter property). The object returned by `b()` was not created by the calling code, passed to it, or held in its fields, so by the book's list it is a stranger.

`registry.getOrCreate(key).add(item)` is reported when `getOrCreate` returns such an object. The `getOrCreate` method itself is never reported.

It does not report:

- **data structures**: interfaces, type aliases, and classes with only public fields. The book: "if `ctxt` , `Options` , and `ScratchDir` are just data structures with no behavior, then they naturally expose their internal structure, and so Demeter does not apply."
- **property access** of any kind (`opts.limits.max`, destructuring), which is how parameter objects are read.
- **fluent APIs**, where `b()` returns the type of `a` (`query.where(x).limit(1).run()`), and static factory methods, where `a` is a class and `b()` returns an instance of it (`Complex.fromRealNumber(1).plus(z)`).
- **types from the TypeScript standard library and `node_modules`**: `Promise`, `Array`, `string`, `Map`, and the classes of the packages the project uses. This covers both the returned type and the method called first: `this.buckets.get(key)?.add(item)` and `items.find(isOpen)?.close()` take an object out of a standard container the code holds, which is how a class keeps the objects in its fields.
- **a free function's result** (`makeBucket().add(item)`): the rule checks the book's `a.b().c()` shape only.
- a value typed `any` or `unknown`, and a union with any member that is not an object.

## Examples

Incorrect:

```ts
class Bucket {
  private items: string[] = [];
  add(item: string): void {
    this.items.push(item);
  }
}

function put(registry: Registry, key: string, item: string) {
  registry.getOrCreate(key).add(item);
}
```

Correct:

```ts
class Registry {
  private buckets = new Map<string, Bucket>();
  addTo(key: string, item: string): void {
    this.buckets.get(key)?.add(item); // an object held in the class's own field
  }
}

function put(registry: Registry, key: string, item: string) {
  registry.addTo(key, item);
}

function limit(opts: Opts) {
  return opts.limits.max; // a data structure, read through properties
}
```

## Why there is no autofix

The remedy moves behaviour into another class. The book calls it "Tell the Other Guy": tell the object you know to do the job, instead of reaching through it. Which class gets the new method, and what it is called, are design decisions.
