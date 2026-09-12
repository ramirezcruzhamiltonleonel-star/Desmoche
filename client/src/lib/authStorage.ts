import type { AuthUser } from "./api";

const TOKEN_KEY = "desmoche.token";
const USER_KEY = "desmoche.user";

export interface StoredAuth {
  token: string;
  user: AuthUser;
}

export function loadAuth(): StoredAuth | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const userJson = localStorage.getItem(USER_KEY);
    if (!token || !userJson) return null;
    return { token, user: JSON.parse(userJson) as AuthUser };
  } catch {
    return null;
  }
}

export function saveAuth(token: string, user: AuthUser): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // Private browsing / storage disabled — session just won't survive a refresh.
  }
}

export function clearAuth(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // ignore
  }
}
