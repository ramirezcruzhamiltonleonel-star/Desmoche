import type { PrismaClient } from "@prisma/client";
import type { StakeType } from "@desmoche/shared";
import { isGuestPlayerId } from "../auth/guestId";
import { isBotPlayerId } from "../game/bot";
import { GameError } from "../game/errors";

/**
 * Pure decision: does this seat need to prove it can cover the ante before
 * sitting down? Guests have no persistent balance to check against yet (see
 * the "fichas iniciales para invitados" item — a separate, later feature),
 * and bots are permanently topped up (see db/seedBots.ts), so neither is
 * ever blocked. Dare mode has no ante at all, and money mode is
 * schema-only for now — both skip this check entirely. Kept separate from
 * the actual balance lookup so the decision itself has full test coverage
 * without needing a real database.
 */
export function affordabilityCheckApplies(playerId: string, stakeType: StakeType, ante: number): boolean {
  if (stakeType !== "chips" || ante <= 0) return false;
  if (isGuestPlayerId(playerId) || isBotPlayerId(playerId)) return false;
  return true;
}

/**
 * Rejects sitting a registered human down at a chips-stake table with more
 * ante than they can actually cover — there was no minimum to sit down
 * before this, so a balance could go straight to negative on the very first
 * hand.
 */
export async function assertCanAffordAnte(
  prisma: PrismaClient,
  userId: string,
  stakeType: StakeType,
  ante: number,
): Promise<void> {
  if (!affordabilityCheckApplies(userId, stakeType, ante)) return;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { chipBalance: true } });
  if (!user || user.chipBalance < ante) {
    throw new GameError(
      `No tenés fichas suficientes para sentarte en esta mesa — necesitás al menos ${ante} (tenés ${user?.chipBalance ?? 0}).`,
    );
  }
}
