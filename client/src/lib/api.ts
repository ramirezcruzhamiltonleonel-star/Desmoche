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
