export class QueryBuilder {
  limit = 10;
  name = "";

  setLimit(limit: number): this {
    this.limit = limit;
    return this;
  }

  setName(name: string): this {
    this.name = name;
    return this;
  }
}
