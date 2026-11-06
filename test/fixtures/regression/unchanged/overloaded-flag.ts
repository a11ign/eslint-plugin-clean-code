export function format(value: number): string;
export function format(value: number, verbose: boolean): string;
export function format(value: number, verbose?: boolean): string {
  return verbose ? `value ${value}` : String(value);
}
