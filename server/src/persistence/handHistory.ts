import type { PrismaClient } from "@prisma/client";
import { isGuestPlayerId } from "../auth/guestId";
import type { HandOutcome } from "../game/payouts";
import type { Room } from "../rooms/room";
import { updateStreakForPlay } from "./streak";

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
 *
 * Guest seats are deliberately excluded from the players.create list and
 * the chip-balance/streak update loops — HandHistoryPlayer.userId has a hard
 * foreign key to a real User row, and a guest never gets one (that's the
 * whole point: nothing persists for them). Bots are NOT excluded here: per
 * game/bot.ts and db/seedBots.ts, every bot persona is a real, permanently
 * seeded User row (huge fixed chip balance, topped up if it ever runs low),
 * specifically so a table with a bot seated settles exactly like an
 * all-human one with zero bot-specific branching anywhere in persistence.
 * Excluding guests still lets the rest of the table's real participants get
 * recorded normally; winnerUserId itself has no such constraint, so a guest
 * winning is fine to record there even though they get no HandHistoryPlayer
 * row of their own.
 *
 * If EVERY seat is a guest (realSeats empty — no bots either, since a bot
 * would itself count as a non-guest real seat), nothing about this hand
 * gets written at all: no TableRecord, no HandHistoryRecord. "No deja
 * rastro" for an all-guest table means exactly that — not merely omitting
 * guest player rows from an otherwise-created record.
 */
export async function persistHandOutcome(
  prisma: PrismaClient,
  room: Room,
  outcome: HandOutcome,
): Promise<void> {
  const table = room.requireTable();
  const seats = table.state.seats;
  const realSeats = seats.filter((seat) => !isGuestPlayerId(seat.playerId));
  if (realSeats.length === 0) return;

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
        create: realSeats.map((seat) => ({
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
      if (delta === 0 || isGuestPlayerId(userId)) continue;
      await prisma.user.update({
        where: { id: userId },
        data: { chipBalance: { increment: delta } },
      });
    }
  }

  // Streak: every real participant just played a hand, win or lose — update
  // each one's running streak independently (sequentially, not in
  // parallel, so a transient failure on one user's row can't race with
  // another's read-then-write against the same connection pool).
  const now = new Date();
  for (const seat of realSeats) {
    const user = await prisma.user.findUnique({
      where: { id: seat.playerId },
      select: { currentStreak: true, longestStreak: true, lastPlayedDate: true },
    });
    if (!user) continue;
    const next = updateStreakForPlay(user, now);
    if (next === user) continue; // already played today, nothing to write
    await prisma.user.update({
      where: { id: seat.playerId },
      data: {
        currentStreak: next.currentStreak,
        longestStreak: next.longestStreak,
        lastPlayedDate: next.lastPlayedDate,
      },
    });
  }
}
