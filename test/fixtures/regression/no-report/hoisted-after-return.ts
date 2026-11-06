export function total(values: number[]): number {
  return values.reduce(add, 0);

  function add(sum: number, value: number): number {
    return sum + value;
  }
}
