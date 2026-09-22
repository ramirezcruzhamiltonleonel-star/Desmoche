const STORAGE_KEY = "desmoche.firstClaimHintSeen";

/** localStorage, not sessionStorage — "solo la primera vez en su sesión/cuenta" should survive closing the tab, same durability as the tutorial-seen flag. */
export function hasFirstClaimHintBeenSeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "yes";
  } catch {
    return false;
  }
}

export function markFirstClaimHintSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "yes");
  } catch {
    // ignore
  }
}
