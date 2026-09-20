const SERVER_URL = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? "http://localhost:4000";

export interface RequestOtpResponse {
  devCode: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  chipBalance: number;
}

export interface VerifyOtpResponse {
  token: string;
  user: AuthUser;
}

interface ErrorBody {
  message: string;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${SERVER_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data: unknown = await res.json();
  if (!res.ok) {
    const message = (data as Partial<ErrorBody>).message ?? "Error de red";
    throw new Error(message);
  }
  return data as T;
}

export function requestOtp(email: string): Promise<RequestOtpResponse> {
  return postJson<RequestOtpResponse>("/auth/request-code", { email });
}

export function verifyOtp(email: string, code: string, displayName?: string): Promise<VerifyOtpResponse> {
  return postJson<VerifyOtpResponse>("/auth/verify-code", { email, code, displayName });
}

/** "Jugar ahora": a temporary guest session — no email, no OTP, nothing saved server-side. */
export function requestGuestSession(displayName: string): Promise<VerifyOtpResponse> {
  return postJson<VerifyOtpResponse>("/auth/guest", { displayName });
}

export interface UserStats {
  handsPlayed: number;
  handsWon: number;
  netChipsAllTime: number;
  handsWithBonus: number;
  /** Chips netted on this user's single best win ever. Null if they've never won a chips-mode hand. */
  biggestWinChips: number | null;
  /** Distinct tables (by code) this user has ever played at least one hand at — a simple running total, not a breakable streak. */
  tablesPlayed: number;
}

export async function fetchMyStats(token: string): Promise<UserStats> {
  const res = await fetch(`${SERVER_URL}/users/me/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data: unknown = await res.json();
  if (!res.ok) {
    const message = (data as Partial<ErrorBody>).message ?? "Error de red";
    throw new Error(message);
  }
  return data as UserStats;
}
