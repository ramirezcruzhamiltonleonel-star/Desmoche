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
  /**
   * Distinct real tables (by table CODE, not TableRecord row — a fresh
   * TableRecord is created per hand persisted, even across hands at the
   * same code, so counting tableId would just equal handsPlayed) this user
   * has played at least one hand at, ever. A deliberately simple running
   * count, not a breakable day-streak (which would need date tracking and
   * a definition of what breaks it) — no schema change needed either way.
   */
  tablesPlayed: number;
}

export async function getUserStats(prisma: PrismaClient, userId: string): Promise<UserStats> {
  const [handsPlayed, handsWon, netChipsAgg, handsWithBonus, biggestWin, handsWithTable] = await Promise.all([
    prisma.handHistoryPlayer.count({ where: { userId } }),
    prisma.handHistoryPlayer.count({ where: { userId, isWinner: true } }),
    prisma.handHistoryPlayer.aggregate({ where: { userId }, _sum: { chipsDelta: true } }),
    prisma.handHistoryPlayer.count({ where: { userId, bonusChipsCollected: { gt: 0 } } }),
    prisma.handHistoryPlayer.findFirst({
      where: { userId, isWinner: true },
      orderBy: { chipsDelta: "desc" },
    }),
    prisma.handHistoryPlayer.findMany({
      where: { userId },
      select: { hand: { select: { table: { select: { code: true } } } } },
    }),
  ]);

  return {
    handsPlayed,
    handsWon,
    netChipsAllTime: netChipsAgg._sum.chipsDelta ?? 0,
    handsWithBonus,
    biggestWinChips: biggestWin?.chipsDelta ?? null,
    tablesPlayed: new Set(handsWithTable.map((h) => h.hand.table.code)).size,
  };
}
