import type { PrismaClient } from "@prisma/client";
import { createTestDb } from "../testUtils/testDb";
import { AuthError } from "./errors";
import { requestOtp, verifyOtp } from "./authService";
import { verifyAuthToken } from "./jwt";
import { generateOtp, hashOtp } from "./otp";

jest.setTimeout(30_000);

let prisma: PrismaClient;
let cleanup: () => Promise<void>;

beforeAll(() => {
  const db = createTestDb();
  prisma = db.prisma;
  cleanup = db.cleanup;
});

afterAll(async () => {
  await cleanup();
});

async function latestCodeFor(email: string): Promise<string> {
  const result = await requestOtp(prisma, email);
  expect(result.devCode).not.toBeNull();
  return result.devCode!;
}

describe("requestOtp", () => {
  it("rejects an invalid email", async () => {
    await expect(requestOtp(prisma, "not-an-email")).rejects.toThrow(AuthError);
  });

  it("enforces a cooldown between requests for the same email", async () => {
    await requestOtp(prisma, "cooldown@example.com");
    await expect(requestOtp(prisma, "cooldown@example.com")).rejects.toThrow(AuthError);
  });

  it("normalizes email case so cooldown applies consistently", async () => {
    await requestOtp(prisma, "CaseTest@Example.com");
    await expect(requestOtp(prisma, "casetest@example.com")).rejects.toThrow(AuthError);
  });
});

describe("verifyOtp", () => {
  it("creates a new user on first login and issues a valid token", async () => {
    const email = "ana@example.com";
    const code = await latestCodeFor(email);

    const { token, user } = await verifyOtp(prisma, email, code, "Ana");

    expect(user.email).toBe(email);
    expect(user.displayName).toBe("Ana");
    expect(user.chipBalance).toBe(1000);

    const payload = verifyAuthToken(token);
    expect(payload).toEqual({ userId: user.id, email, displayName: "Ana" });
  });

  it("falls back to the email's local part when no display name is given", async () => {
    const email = "noname@example.com";
    const code = await latestCodeFor(email);
    const { user } = await verifyOtp(prisma, email, code);
    expect(user.displayName).toBe("noname");
  });

  it("rejects an incorrect code", async () => {
    const email = "wrongcode@example.com";
    await latestCodeFor(email);
    await expect(verifyOtp(prisma, email, "000000")).rejects.toThrow(AuthError);
  });

  it("rejects reusing an already-consumed code", async () => {
    const email = "reuse@example.com";
    const code = await latestCodeFor(email);
    await verifyOtp(prisma, email, code, "Reuse");
    await expect(verifyOtp(prisma, email, code)).rejects.toThrow(AuthError);
  });

  it("rejects an expired code", async () => {
    const email = "expired@example.com";
    const code = await latestCodeFor(email);
    await prisma.oneTimeCode.updateMany({
      where: { email: "expired@example.com" },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(verifyOtp(prisma, email, code)).rejects.toThrow(AuthError);
  });

  it("logs an existing user back in without overwriting their display name", async () => {
    const email = "returning@example.com";
    const firstCode = await latestCodeFor(email);
    const { user: firstUser } = await verifyOtp(prisma, email, firstCode, "Original Name");

    // Insert the second login's code directly — requestOtp's cooldown isn't
    // what this test is about, and a real resend wouldn't happen this fast.
    const secondCode = generateOtp();
    await prisma.oneTimeCode.create({
      data: {
        email,
        codeHash: hashOtp(secondCode),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    const { user: secondUser } = await verifyOtp(prisma, email, secondCode, "Attempted Rename");

    expect(secondUser.id).toBe(firstUser.id);
    expect(secondUser.displayName).toBe("Original Name");
  });
});
