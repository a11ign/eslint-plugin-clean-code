# clean-code-book/no-trivial-accessors

Do not push private fields out through trivial getters: hide the implementation behind an abstraction.

- **Config:** `recommended`
- **Fix:** none
- **Catalog entry:** OBJ-03

## What the book says

> "Hiding implementation is not just a matter of putting a layer of functions between the variables. Hiding implementation is about abstractions! A class does not simply push its variables out through getters and setters."

*Clean Code, 2nd Edition*, chapter 12 Objects and Data Structures § Data Abstraction (bookCTX chunk 19).

## What it reports

A class in which every private field (TypeScript `private`, including a `private` parameter property, or `#private`) has a trivial getter, and which has no other methods. That is a data structure in disguise. The book's verdict on such classes: "The `Address` DTO might as well have public fields." (chunk 20)

- A trivial getter is a `get` accessor, or a method with no parameters, whose body is only `return this.x;`.
- Trivial setters (a `set` accessor, or a one-parameter method, whose body is only `this.x = value;`) are accessors too, so they do not count as other methods.
- The constructor and `static` members are not counted.

It does not report:

- a class with any other instance method, or a getter or setter that does more than read or write a field;
- a class with a private field that has no trivial getter;
- a class with no private fields (a plain data structure), or with only `protected` ones.

## Examples

Incorrect:

```ts
class Address {
  constructor(private street: string, private city: string) {}

  getStreet(): string {
    return this.street;
  }

  getCity(): string {
    return this.city;
  }
}
```

Correct:

```ts
interface Address {
  street: string;
  city: string;
}

class Vehicle {
  #fuelTankCapacity = 50;
  #gallonsOfGasoline = 10;

  percentFuelRemaining(): number {
    return (this.#gallonsOfGasoline / this.#fuelTankCapacity) * 100;
  }
}
```

## Why there is no autofix

Public fields behave differently from accessors under `Object.keys`, spreading, JSON serialisation and `Object.defineProperty`: an accessor on the prototype would become an own data property. Choosing an abstraction instead needs names the syntax cannot supply.
