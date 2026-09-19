const KEY = "desmoche.guestNameHint";

/** Carries a guest's chosen name across into the real signup form if they later click "Crear cuenta" — a convenience, not sensitive data, so a plain localStorage string is fine. */
export function saveGuestNameHint(name: string): void {
  try {
    localStorage.setItem(KEY, name);
  } catch {
    // ignore
  }
}

export function loadGuestNameHint(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function clearGuestNameHint(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
