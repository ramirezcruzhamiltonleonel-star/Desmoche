import type { PrismaClient } from "@prisma/client";

export interface UserStats {
  handsPlayed: number;
  handsWon: number;
  /** Net chip change across every hand ever recorded for this user, not just the current session. */
  netChipsAllTime: number;
  /** Hands won that included at least one Mico/Patona bonus on top of the plain pot. */
  handsWithBonus: number;
  /**
   * Chips netted on this user's single best win ever (the winning hand's
   * chipsDelta — pot minus their own ante, plus any Mico/Patona bonus).
   * Null if they've never won a chips-mode hand. Derived entirely from
   * existing columns, no schema change needed.
   */
  biggestWinChips: number | null;
}

export async function getUserStats(prisma: PrismaClient, userId: string): Promise<UserStats> {
  const [handsPlayed, handsWon, netChipsAgg, handsWithBonus, biggestWin] = await Promise.all([
    prisma.handHistoryPlayer.count({ where: { userId } }),
    prisma.handHistoryPlayer.count({ where: { userId, isWinner: true } }),
    prisma.handHistoryPlayer.aggregate({ where: { userId }, _sum: { chipsDelta: true } }),
    prisma.handHistoryPlayer.count({ where: { userId, bonusChipsCollected: { gt: 0 } } }),
    prisma.handHistoryPlayer.findFirst({
      where: { userId, isWinner: true },
      orderBy: { chipsDelta: "desc" },
    }),
  ]);

  return {
    handsPlayed,
    handsWon,
    netChipsAllTime: netChipsAgg._sum.chipsDelta ?? 0,
    handsWithBonus,
    biggestWinChips: biggestWin?.chipsDelta ?? null,
  };
}
