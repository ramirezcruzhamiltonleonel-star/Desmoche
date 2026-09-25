import { useEffect } from "react";

/**
 * Closes the calling modal on Escape — previously only one modal (the
 * "leave as guest?" confirmation) had this, so stacked modals (help on top
 * of the tutorial, history on top of rules, etc.) had no way to back out
 * except hunting for each one's own close button. `enabled` lets a caller
 * skip attaching the listener entirely rather than passing a no-op.
 */
export function useEscapeKey(onEscape: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return undefined;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onEscape();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
