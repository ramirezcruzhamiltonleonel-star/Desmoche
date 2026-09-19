import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { requestGuestSession, requestOtp, verifyOtp, type AuthUser, type RequestOtpResponse } from "../lib/api";
import { clearAuth, loadAuth, saveAuth } from "../lib/authStorage";
import { clearGuestAuth, loadGuestAuth, saveGuestAuth } from "../lib/guestSessionStorage";
import { clearTableCode } from "../lib/tableStorage";

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  /** True for a "Jugar ahora" session. Persisted to sessionStorage (this tab only) so a page refresh doesn't log the guest out mid-table — see guestSessionStorage.ts. */
  isGuest: boolean;
  requestCode: (email: string) => Promise<RequestOtpResponse>;
  verifyCode: (email: string, code: string, displayName?: string) => Promise<void>;
  /** "Jugar ahora": just a name, no email/OTP. */
  loginAsGuest: (displayName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadInitialSession(): { token: string; user: AuthUser; isGuest: boolean } | null {
  const real = loadAuth();
  if (real) return { ...real, isGuest: false };
  const guest = loadGuestAuth();
  if (guest) return { ...guest, isGuest: true };
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(() => loadInitialSession(), []);
  const [token, setToken] = useState<string | null>(initial?.token ?? null);
  const [user, setUser] = useState<AuthUser | null>(initial?.user ?? null);
  const [isGuest, setIsGuest] = useState(initial?.isGuest ?? false);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isGuest,
      requestCode: (email) => requestOtp(email),
      verifyCode: async (email, code, displayName) => {
        const result = await verifyOtp(email, code, displayName);
        saveAuth(result.token, result.user);
        setToken(result.token);
        setUser(result.user);
        setIsGuest(false);
      },
      loginAsGuest: async (displayName) => {
        const result = await requestGuestSession(displayName);
        saveGuestAuth(result.token, result.user);
        setToken(result.token);
        setUser(result.user);
        setIsGuest(true);
      },
      logout: () => {
        clearAuth();
        clearGuestAuth();
        // Whichever kind of session this was, don't leave a stale table code
        // behind for a future session (fresh guest, or a different real
        // account on this browser) to silently try to rejoin.
        clearTableCode(false);
        clearTableCode(true);
        setToken(null);
        setUser(null);
        setIsGuest(false);
      },
    }),
    [token, user, isGuest],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
