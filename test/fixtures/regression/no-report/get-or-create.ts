export class Cache {
  readonly #items = new Map<string, number[]>();

  getOrCreate(key: string): number[] {
    const found = this.#items.get(key);
    if (found) return found;
    const created: number[] = [];
    this.#items.set(key, created);
    return created;
  }

  has(key: string): boolean {
    return this.#items.has(key);
  }
}

export function lengthOf(cache: Cache, key: string): number {
  return cache.getOrCreate(key).length;
}
