export function drainQueue(): void {
  process.nextTick(drainQueue);
}
