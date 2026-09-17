import type { PrismaClient } from "@prisma/client";
import type { HandOutcome } from "../game/payouts";
import type { Room } from "../rooms/room";

/**
 * Persists one finished hand's result: a row per seated player (for
 * per-user hand history) and, for chip-stake tables only, the resulting
 * chip balance movement. Dare tables have no money to move; real-money
 * tables are schema-only for now (see plan) — the hand is still logged, but
 * no balance changes hands.
 *
 * "carry-over" ("se va doble" — the stock ran out with nobody winning) is
 * still logged, with no winner and every delta at 0: the ante each player
 * "put in" for that hand only ever shows up in the eventual winning hand's
 * bigger potWon, never as its own balance movement.
 */
export async function persistHandOutcome(
  prisma: PrismaClient,
  room: Room,
  outcome: HandOutcome,
): Promise<void> {
  const table = room.requireTable();
  const seats = table.state.seats;
  const reason = table.state.handOutcome?.reason ?? "meld-out";
  const winnerId = outcome.kind === "carry-over" ? null : outcome.winnerId;

  const deltas = new Map<string, number>(seats.map((seat) => [seat.playerId, 0]));
  let bonusChipsCollected = 0; // Mico/Patona extras only, not the base ante pot

  if (outcome.kind === "chips" || outcome.kind === "money") {
    for (const [loserId, extra] of Object.entries(outcome.extraPerLoser)) {
      deltas.set(loserId, -room.ante - extra);
      bonusChipsCollected += extra;
    }
    deltas.set(outcome.winnerId, outcome.potWon - room.ante + bonusChipsCollected);
  }

  const tableRecord = await prisma.tableRecord.create({
    data: { code: room.code, stakeType: room.stakeType, ante: room.ante },
  });

  await prisma.handHistoryRecord.create({
    data: {
      tableId: tableRecord.id,
      reason,
      winnerUserId: winnerId,
      players: {
        create: seats.map((seat) => ({
          userId: seat.playerId,
          seatIndex: seat.seatIndex,
          isWinner: seat.playerId === winnerId,
          chipsDelta: deltas.get(seat.playerId) ?? 0,
          bonusChipsCollected: seat.playerId === winnerId ? bonusChipsCollected : 0,
        })),
      },
    },
  });

  if (outcome.kind === "chips") {
    for (const [userId, delta] of deltas) {
      if (delta === 0) continue;
      await prisma.user.update({
        where: { id: userId },
        data: { chipBalance: { increment: delta } },
      });
    }
  }
}
