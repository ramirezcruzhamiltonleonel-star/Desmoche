import type { PrismaClient } from "@prisma/client";
import { BOT_PERSONAS } from "../game/bot";

const STARTING_BOT_BALANCE = 1_000_000;
const TOP_UP_FLOOR = 1_000;

/**
 * Bots are real `User` rows (fixed id, one per persona) so hand history and
 * chip-balance persistence need zero bot-specific branching — a table with a
 * bot seated settles exactly like an all-human one. Idempotent: safe to call
 * on every server boot. Balances aren't reset on every boot (a bot's balance
 * moves like anyone else's as it plays), only topped back up if it ever runs
 * low, so bots never become an obstacle to a chips-mode hand completing.
 */
export async function seedBotUsers(prisma: PrismaClient): Promise<void> {
  for (const persona of BOT_PERSONAS) {
    const existing = await prisma.user.findUnique({ where: { id: persona.id } });
    if (!existing) {
      await prisma.user.create({
        data: {
          id: persona.id,
          email: `${persona.id}@desmoche.bot`,
          displayName: persona.displayName,
          chipBalance: STARTING_BOT_BALANCE,
        },
      });
    } else if (existing.chipBalance < TOP_UP_FLOOR) {
      await prisma.user.update({
        where: { id: persona.id },
        data: { chipBalance: STARTING_BOT_BALANCE },
      });
    }
  }
}
