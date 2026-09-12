import { createHash, randomInt } from "node:crypto";

/** 6-digit numeric one-time code, e.g. "042817". */
export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Codes are stored hashed — never keep the plaintext code at rest. */
export function hashOtp(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}
