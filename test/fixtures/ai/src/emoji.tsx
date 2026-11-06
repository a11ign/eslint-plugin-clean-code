export function report(logger: { info: (message: string) => void }) {
  logger.info("✅ Invoices exported 🚀");
  logger.info("Step 1 → Step 2 ✓");
}

export const Welcome = () => <h1>🎉 Welcome</h1>;
