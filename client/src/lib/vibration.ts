/** Best-effort — silently does nothing where the Vibration API isn't available (desktop browsers, iOS Safari). */
export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // ignore
  }
}
