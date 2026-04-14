/**
 * Try the Web Share API first (mobile share sheet, AirDrop, etc.),
 * then fall back to clipboard copy.
 *
 * Returns `"shared"` if the system share sheet was used successfully,
 * `"copied"` if the value was written to the clipboard, or `null` if
 * both paths failed (e.g. permissions denied).
 */
export async function shareOrCopy(
  payload: { title?: string; text?: string; url?: string },
  clipboardText: string,
): Promise<"shared" | "copied" | null> {
  if (navigator.share) {
    try {
      await navigator.share(payload);
      return "shared";
    } catch {
      // User cancelled or browser rejected the payload — fall through.
    }
  }

  try {
    await navigator.clipboard.writeText(clipboardText);
    return "copied";
  } catch {
    return null;
  }
}
