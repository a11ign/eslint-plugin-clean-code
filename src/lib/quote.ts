/** The longest piece of source text a message quotes. */
const QUOTE_LENGTH = 60;

/** `text` on one line, cut to QUOTE_LENGTH characters with `…`, for quoting in a message. */
export function shortQuote(text: string): string {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > QUOTE_LENGTH ? `${line.slice(0, QUOTE_LENGTH - 1)}…` : line;
}
