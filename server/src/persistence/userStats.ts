import type { PrismaClient } from "@prisma/client";

export interface UserStats {
  handsPlayed: number;
  handsWon: number;
  /** Net chip change across every hand ever recorded for this user, not just the current session. */
  netChipsAllTime: number;
  /** Hands won that included at least one Mico/Patona bonus on top of the plain pot. */
  handsWithBonus: number;
}

export async function getUserStats(prisma: PrismaClient, userId: string): Promise<UserStats> {
  const [handsPlayed, handsWon, netChipsAgg, handsWithBonus] = await Promise.all([
    prisma.handHistoryPlayer.count({ where: { userId } }),
    prisma.handHistoryPlayer.count({ where: { userId, isWinner: true } }),
    prisma.handHistoryPlayer.aggregate({ where: { userId }, _sum: { chipsDelta: true } }),
    prisma.handHistoryPlayer.count({ where: { userId, bonusChipsCollected: { gt: 0 } } }),
  ]);

  return {
    handsPlayed,
    handsWon,
    netChipsAllTime: netChipsAgg._sum.chipsDelta ?? 0,
    handsWithBonus,
  };
}
