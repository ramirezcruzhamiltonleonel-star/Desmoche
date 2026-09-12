const CODE_KEY = "desmoche.lastTableCode";

export function loadTableCode(): string | null {
  try {
    return localStorage.getItem(CODE_KEY);
  } catch {
    return null;
  }
}

export function saveTableCode(code: string): void {
  try {
    localStorage.setItem(CODE_KEY, code);
  } catch {
    // ignore
  }
}

export function clearTableCode(): void {
  try {
    localStorage.removeItem(CODE_KEY);
  } catch {
    // ignore
  }
}
