import jwt from "jsonwebtoken";

function resolveSecret(): string {
  const configured = process.env.JWT_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET debe estar definido en producción");
  }
  // eslint-disable-next-line no-console
  console.warn("JWT_SECRET no definido — usando un valor de desarrollo inseguro");
  return "dev-insecure-secret-do-not-use-in-production";
}

const SECRET = resolveSecret();

export interface AuthTokenPayload {
  userId: string;
  email: string;
  displayName: string;
}

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: "30d" });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, SECRET);
  if (typeof decoded === "string") throw new Error("Token inválido");
  const { userId, email, displayName } = decoded as Record<string, unknown>;
  if (typeof userId !== "string" || typeof email !== "string" || typeof displayName !== "string") {
    throw new Error("Token inválido");
  }
  return { userId, email, displayName };
}
