const CODE_KEY = "desmoche.lastTableCode";
const MODE_KEY = "desmoche.lastTableMode";

export type TableMode = "player" | "spectator";

export function loadTableCode(): string | null {
  try {
    return localStorage.getItem(CODE_KEY);
  } catch {
    return null;
  }
}

/** Defaults to "player" for any table code saved before spectating existed. */
export function loadTableMode(): TableMode {
  try {
    return localStorage.getItem(MODE_KEY) === "spectator" ? "spectator" : "player";
  } catch {
    return "player";
  }
}

export function saveTableCode(code: string, mode: TableMode): void {
  try {
    localStorage.setItem(CODE_KEY, code);
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // ignore
  }
}

export function clearTableCode(): void {
  try {
    localStorage.removeItem(CODE_KEY);
    localStorage.removeItem(MODE_KEY);
  } catch {
    // ignore
  }
}
