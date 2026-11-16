/**
 * Adds two numbers.
 * @param first the first number
 * @param second the second number
 * @param third a parameter that was renamed away
 */
export function add(first: number, second: number): number {
  return first + second;
}

/**
 * Doubles a number.
 * @param value the number
 * @retrun twice the number
 */
export function double(value: number): number {
  return value * 2;
}

/**
 * Waits for a moment.
 * @async until the timer fires
 */
export async function pause(): Promise<void> {
  await Promise.resolve();
}

/**
 * Halves a number.
 * @param {number} value the number
 * @returns half the number
 */
export function halve(value: number): number {
  return value / 2;
}
