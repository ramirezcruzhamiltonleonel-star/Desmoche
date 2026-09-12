import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { requestOtp, verifyOtp, type AuthUser, type RequestOtpResponse } from "../lib/api";
import { clearAuth, loadAuth, saveAuth } from "../lib/authStorage";

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  requestCode: (email: string) => Promise<RequestOtpResponse>;
  verifyCode: (email: string, code: string, displayName?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(() => loadAuth(), []);
  const [token, setToken] = useState<string | null>(initial?.token ?? null);
  const [user, setUser] = useState<AuthUser | null>(initial?.user ?? null);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      requestCode: (email) => requestOtp(email),
      verifyCode: async (email, code, displayName) => {
        const result = await verifyOtp(email, code, displayName);
        saveAuth(result.token, result.user);
        setToken(result.token);
        setUser(result.user);
      },
      logout: () => {
        clearAuth();
        setToken(null);
        setUser(null);
      },
    }),
    [token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
