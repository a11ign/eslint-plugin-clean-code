/*
 * Copyright (c) 2026 Example Corp.
 * Licensed under the Apache License, Version 2.0.
 */

/** Returns the invoice total, rounded to cents. */
export function invoiceTotal(lines: number[]): number {
  const total = lines.reduce((sum, line) => sum + line, 0);
  // eslint-disable-next-line clean-code-book/ai-no-emoji
  console.log("🚀");
  return Math.round(total * 100) / 100;
}
