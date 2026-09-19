import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { requestGuestSession, requestOtp, verifyOtp, type AuthUser, type RequestOtpResponse } from "../lib/api";
import { clearAuth, loadAuth, saveAuth } from "../lib/authStorage";

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  /** True for a "Jugar ahora" session — nothing about it is ever persisted, including across a page reload. */
  isGuest: boolean;
  requestCode: (email: string) => Promise<RequestOtpResponse>;
  verifyCode: (email: string, code: string, displayName?: string) => Promise<void>;
  /** "Jugar ahora": just a name, no email/OTP. Deliberately never touches localStorage — a refresh logs a guest back out, matching "this doesn't persist". */
  loginAsGuest: (displayName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(() => loadAuth(), []);
  const [token, setToken] = useState<string | null>(initial?.token ?? null);
  const [user, setUser] = useState<AuthUser | null>(initial?.user ?? null);
  const [isGuest, setIsGuest] = useState(false);

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
        // No saveAuth() here — a guest session lives only in memory for this tab.
        setToken(result.token);
        setUser(result.user);
        setIsGuest(true);
      },
      logout: () => {
        clearAuth();
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
