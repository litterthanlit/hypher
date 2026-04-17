/**
 * stripQuotedReply — remove the quoted-reply chain from an email text body.
 *
 * Conservative by design: false-negatives (leaving a quoted block in) are
 * tolerable; false-positives (eating the user's new content) are not.
 * If no recognised delimiter is found the original text is returned unchanged.
 *
 * Recognised delimiters (first matching line ends the new content):
 *   - Lines starting with ">" (standard quote character)
 *   - Lines matching "On <anything> wrote:" (Gmail / Apple Mail attribution)
 *   - Lines matching "--- Original Message ---" (Outlook-style divider)
 */
export function stripQuotedReply(text: string): string {
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (
      /^>/.test(line) ||
      /^On .+ wrote:\s*$/.test(line.trim()) ||
      /^-{3,}\s*Original Message\s*-{3,}/i.test(line.trim())
    ) {
      // Return everything before this line, trimming trailing blank lines
      return lines.slice(0, i).join("\n").trimEnd();
    }
  }

  // No delimiter found — return unchanged
  return text;
}
