import type { AuthUser } from "./api";

const TOKEN_KEY = "desmoche.guest.token";
const USER_KEY = "desmoche.guest.user";

export interface StoredGuestAuth {
  token: string;
  user: AuthUser;
}

/**
 * sessionStorage, not localStorage: a guest's identity should survive a
 * refresh of THIS tab (that's the whole point — see the lobby-refresh bug
 * this exists to fix) but still disappear the moment the tab actually
 * closes, matching the original "leaves zero trace" design intent for guest
 * mode. A real account's auth (authStorage.ts) deliberately keeps using
 * localStorage since it's meant to persist across tabs/restarts.
 */
export function loadGuestAuth(): StoredGuestAuth | null {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const userJson = sessionStorage.getItem(USER_KEY);
    if (!token || !userJson) return null;
    return { token, user: JSON.parse(userJson) as AuthUser };
  } catch {
    return null;
  }
}

export function saveGuestAuth(token: string, user: AuthUser): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // Private browsing / storage disabled — session just won't survive a refresh.
  }
}

export function clearGuestAuth(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  } catch {
    // ignore
  }
}
