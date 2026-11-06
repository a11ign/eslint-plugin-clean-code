export function rethrows(run: () => void): void {
  try {
    run();
  } catch (error) { console.error(error); throw error; }
}

export function swallows(run: () => void, logger: { error: (error: unknown) => void }): void {
  try {
    run();
  } catch (error) { logger.error(error); }
}
