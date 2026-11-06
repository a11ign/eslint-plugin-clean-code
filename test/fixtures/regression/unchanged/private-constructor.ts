export class Registry {
  private constructor(private readonly names: string[]) {}

  static empty(): Registry {
    return new Registry([]);
  }

  find(name: string): string | undefined;
  find(index: number): string | undefined;
  find(key: string | number): string | undefined {
    return typeof key === "number" ? this.names[key] : this.names.find((name) => name === key);
  }
}
