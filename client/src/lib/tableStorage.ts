const CODE_KEY = "desmoche.lastTableCode";
const MODE_KEY = "desmoche.lastTableMode";
const GUEST_CODE_KEY = "desmoche.guest.lastTableCode";
const GUEST_MODE_KEY = "desmoche.guest.lastTableMode";

export type TableMode = "player" | "spectator";

// A guest's table code lives in sessionStorage (same tab, gone on close) for
// the same reason their auth does — see guestSessionStorage.ts. A real
// account keeps using localStorage so it survives across tabs/restarts.
function storageFor(isGuest: boolean): Storage {
  return isGuest ? sessionStorage : localStorage;
}
function keysFor(isGuest: boolean): { code: string; mode: string } {
  return isGuest ? { code: GUEST_CODE_KEY, mode: GUEST_MODE_KEY } : { code: CODE_KEY, mode: MODE_KEY };
}

export function loadTableCode(isGuest: boolean): string | null {
  try {
    return storageFor(isGuest).getItem(keysFor(isGuest).code);
  } catch {
    return null;
  }
}

/** Defaults to "player" for any table code saved before spectating existed. */
export function loadTableMode(isGuest: boolean): TableMode {
  try {
    return storageFor(isGuest).getItem(keysFor(isGuest).mode) === "spectator" ? "spectator" : "player";
  } catch {
    return "player";
  }
}

export function saveTableCode(isGuest: boolean, code: string, mode: TableMode): void {
  try {
    const store = storageFor(isGuest);
    const keys = keysFor(isGuest);
    store.setItem(keys.code, code);
    store.setItem(keys.mode, mode);
  } catch {
    // ignore
  }
}

export function clearTableCode(isGuest: boolean): void {
  try {
    const store = storageFor(isGuest);
    const keys = keysFor(isGuest);
    store.removeItem(keys.code);
    store.removeItem(keys.mode);
  } catch {
    // ignore
  }
}
