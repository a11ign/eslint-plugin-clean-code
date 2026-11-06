export abstract class Shape {
  protected constructor(readonly sides: number) {}

  abstract area(): number;
}
