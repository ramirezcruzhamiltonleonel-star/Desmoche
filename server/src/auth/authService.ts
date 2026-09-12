import type { PrismaClient, User } from "@prisma/client";
import { AuthError } from "./errors";
import { generateOtp, hashOtp } from "./otp";
import { signAuthToken } from "./jwt";

const CODE_TTL_MS = 10 * 60 * 1000;
const REQUEST_COOLDOWN_MS = 30 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * TODO(fase 3 follow-up): wire a real transactional email provider (Resend,
 * Postmark, SES...) — this only logs, so codes never actually reach an inbox
 * yet. `requestOtp` returns the code directly outside production so the rest
 * of the stack (and tests) can proceed without a provider decision blocking
 * everything else.
 */
async function sendOtpEmail(email: string, code: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[auth] (dev stub, no email provider wired) código para ${email}: ${code}`);
}

export interface RequestOtpResult {
  /** Only populated outside production, since there's no email provider yet. */
  devCode: string | null;
}

export async function requestOtp(db: PrismaClient, email: string): Promise<RequestOtpResult> {
  const normalized = normalizeEmail(email);
  if (!EMAIL_PATTERN.test(normalized)) {
    throw new AuthError("Correo inválido");
  }

  const latest = await db.oneTimeCode.findFirst({
    where: { email: normalized },
    orderBy: { createdAt: "desc" },
  });
  if (latest && Date.now() - latest.createdAt.getTime() < REQUEST_COOLDOWN_MS) {
    throw new AuthError("Espera unos segundos antes de pedir otro código");
  }

  const code = generateOtp();
  await db.oneTimeCode.create({
    data: {
      email: normalized,
      codeHash: hashOtp(code),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });
  await sendOtpEmail(normalized, code);

  return { devCode: process.env.NODE_ENV === "production" ? null : code };
}

export interface VerifyOtpResult {
  token: string;
  user: User;
}

export async function verifyOtp(
  db: PrismaClient,
  email: string,
  code: string,
  displayName?: string,
): Promise<VerifyOtpResult> {
  const normalized = normalizeEmail(email);

  const candidate = await db.oneTimeCode.findFirst({
    where: {
      email: normalized,
      codeHash: hashOtp(code),
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  if (!candidate) {
    throw new AuthError("Código inválido o expirado");
  }
  await db.oneTimeCode.update({
    where: { id: candidate.id },
    data: { consumedAt: new Date() },
  });

  let user = await db.user.findUnique({ where: { email: normalized } });
  if (!user) {
    user = await db.user.create({
      data: {
        email: normalized,
        displayName: displayName?.trim() || normalized.split("@")[0]!,
      },
    });
  }

  const token = signAuthToken({ userId: user.id, email: user.email, displayName: user.displayName });
  return { token, user };
}
