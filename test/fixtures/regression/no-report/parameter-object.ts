interface Limits {
  max: number;
}

interface Options {
  a: number;
  b: number;
  limits: Limits;
}

export function sum({ a, b }: Options): number {
  return a + b;
}

export function maximum(options: Options): number {
  return options.limits.max;
}
