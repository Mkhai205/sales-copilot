/**
 * Detects an active slash command at the cursor position.
 * Returns the slash index and the query typed after '/', or null when
 * the text at the cursor is not an active slash command.
 */
export function findSlashCommand(
  text: string,
  cursorPos: number,
): { slashIndex: number; query: string } | null {
  const textBeforeCursor = text.slice(0, cursorPos);
  const slashIndex = textBeforeCursor.lastIndexOf('/');

  if (slashIndex === -1) return null;

  // Ensure '/' is at the beginning of the text OR preceded by whitespace/newline
  if (slashIndex > 0) {
    const charBeforeSlash = textBeforeCursor[slashIndex - 1];
    if (!/\s/.test(charBeforeSlash)) {
      return null;
    }
  }

  // The text after '/' up to cursor
  const query = textBeforeCursor.slice(slashIndex + 1);

  // If query contains space or newline, it's no longer an active slash command
  if (/\s/.test(query)) {
    return null;
  }

  return { slashIndex, query };
}
