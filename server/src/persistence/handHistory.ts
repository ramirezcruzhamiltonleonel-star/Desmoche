import type { PrismaClient } from "@prisma/client";
import { isGuestPlayerId } from "../auth/guestId";
import { isBotPlayerId } from "../game/bot";
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
 * If no seat is a REGISTERED HUMAN — every seat is either a guest or a bot
 * — nothing about this hand gets written at all: no TableRecord, no
 * HandHistoryRecord, and bots get no streak credit either. A bot is a real
 * User row (see game/bot.ts), so without this separate check a guest-only
 * table against bots would otherwise look "not all-guest" and get fully
 * persisted — including handing the bots a streak for a hand no actual
 * person played. "No deja rastro" for a table with no registered human in
 * it means exactly that, bots at the table or not.
 */
export async function persistHandOutcome(
  prisma: PrismaClient,
  room: Room,
  outcome: HandOutcome,
): Promise<void> {
  const table = room.requireTable();
  const seats = table.state.seats;
  const realSeats = seats.filter((seat) => !isGuestPlayerId(seat.playerId));
  const hasRegisteredHuman = realSeats.some((seat) => !isBotPlayerId(seat.playerId));
  if (!hasRegisteredHuman) return;

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

  // A real chip balance can never go negative — cap what's ACTUALLY taken
  // from any one loser at whatever they still have (guests/bots excluded:
  // guests have no persistent balance yet, bots are always topped up). Any
  // shortfall comes straight off the winner's credit too, so this can never
  // fabricate chips from nothing — the winner simply collects less than the
  // nominal pot on the rare hand where a loser's balance was too thin to
  // cover everything they owed (same as real "table stakes" rules).
  if (outcome.kind === "chips") {
    let totalShortfall = 0;
    for (const [userId, delta] of deltas) {
      if (delta >= 0 || isGuestPlayerId(userId) || isBotPlayerId(userId)) continue;
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { chipBalance: true } });
      const currentBalance = Math.max(0, user?.chipBalance ?? 0);
      const owed = -delta;
      const actualDebit = Math.min(owed, currentBalance);
      totalShortfall += owed - actualDebit;
      deltas.set(userId, -actualDebit);
    }
    if (totalShortfall > 0) {
      deltas.set(outcome.winnerId, (deltas.get(outcome.winnerId) ?? 0) - totalShortfall);
    }
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
