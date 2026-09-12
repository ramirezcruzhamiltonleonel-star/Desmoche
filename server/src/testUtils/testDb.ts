import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

/**
 * Spins up a throwaway SQLite file, pushes the real Prisma schema onto it,
 * and hands back a client pointed there. Auth/persistence tests exercise
 * genuine Prisma queries against a real database instead of mocks.
 */
export function createTestDb(): { prisma: PrismaClient; cleanup: () => Promise<void> } {
  const dbPath = path.join(os.tmpdir(), `desmoche-test-${randomUUID()}.db`);
  const url = `file:${dbPath}`;
  const schemaPath = path.join(__dirname, "..", "..", "prisma", "schema.prisma");

  execSync(`npx prisma db push --schema="${schemaPath}" --skip-generate --accept-data-loss`, {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "ignore",
  });

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  return {
    prisma,
    cleanup: async () => {
      await prisma.$disconnect();
      for (const suffix of ["", "-journal", "-wal", "-shm"]) {
        const p = dbPath + suffix;
        if (existsSync(p)) rmSync(p, { force: true });
      }
    },
  };
}
