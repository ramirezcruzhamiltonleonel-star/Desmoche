const KEY = "desmoche.autoInstantDemoRequested";

/**
 * One-shot signal from LoginScreen's single "Jugar ya" button to
 * HomeScreen's very first render: auth and the game socket live in
 * separate React contexts, so the login click can't call startInstantDemo()
 * itself — it sets this flag instead, and whoever reads it next clears it
 * immediately so a later plain visit to HomeScreen never re-triggers it.
 */
export function markAutoInstantDemoRequested(): void {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    // ignore
  }
}

export function consumeAutoInstantDemoRequested(): boolean {
  try {
    const requested = sessionStorage.getItem(KEY) === "1";
    if (requested) sessionStorage.removeItem(KEY);
    return requested;
  } catch {
    return false;
  }
}
