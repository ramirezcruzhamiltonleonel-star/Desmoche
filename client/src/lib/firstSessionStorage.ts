const STORAGE_KEY = "desmoche.hasPlayedBefore";

/** Whether this browser has ever taken a real in-game action (drawn, placed a meld, responded to a claim, etc.) — used to soften a brand-new player's very first bot table (1 easy bot, no auto-wins) without affecting anyone who's already played. */
export function hasPlayedBefore(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "yes";
  } catch {
    return false;
  }
}

export function markPlayedBefore(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "yes");
  } catch {
    // ignore
  }
}
