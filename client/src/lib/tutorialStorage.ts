const STORAGE_KEY = "desmoche.tutorialSeen";

export function hasTutorialBeenSeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "yes";
  } catch {
    return false;
  }
}

export function markTutorialSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "yes");
  } catch {
    // ignore
  }
}
