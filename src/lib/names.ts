/** Splits an identifier into its camel-case or snake-case words, in lower case: `getHTTPResponse` gives `get`, `http`, `response`. */
export function words(identifier: string): string[] {
  return identifier
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[\s_$-]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
}
