export class Bag {
  *values() {
    yield* this.items
  }
  items = [1, 2]
}
