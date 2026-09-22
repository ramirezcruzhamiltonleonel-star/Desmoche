import type { PrismaClient } from "@prisma/client";
import { DAILY_MISSION_REWARD_CHIPS, isSameUtcDay, missionForDate, toUtcMidnight } from "./dailyMission";

export interface DailyProgress {
  currentStreak: number;
  longestStreak: number;
  mission: {
    description: string;
    target: number;
    progress: number;
    completed: boolean;
  };
  /** Whether today's reward is still there for the taking — false once claimed, even if the mission stays "completed". */
  canClaim: boolean;
}

async function todaysHandCounts(
  prisma: PrismaClient,
  userId: string,
  now: Date,
): Promise<{ played: number; won: number }> {
  const since = toUtcMidnight(now);
  const [played, won] = await Promise.all([
    prisma.handHistoryPlayer.count({ where: { userId, hand: { playedAt: { gte: since } } } }),
    prisma.handHistoryPlayer.count({ where: { userId, isWinner: true, hand: { playedAt: { gte: since } } } }),
  ]);
  return { played, won };
}

export async function getDailyProgress(prisma: PrismaClient, userId: string, now: Date = new Date()): Promise<DailyProgress> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { currentStreak: true, longestStreak: true, dailyMissionClaimedDate: true },
  });
  const mission = missionForDate(now);
  const { played, won } = await todaysHandCounts(prisma, userId, now);
  const progress = mission.key === "win-one" ? won : played;
  const completed = progress >= mission.target;
  const alreadyClaimed = Boolean(user.dailyMissionClaimedDate && isSameUtcDay(user.dailyMissionClaimedDate, now));

  return {
    currentStreak: user.currentStreak,
    longestStreak: user.longestStreak,
    mission: { description: mission.description, target: mission.target, progress: Math.min(progress, mission.target), completed },
    canClaim: completed && !alreadyClaimed,
  };
}

/**
 * Claims today's mission reward if — and only if — it's genuinely completed
 * and hasn't already been claimed today. Returns null (no-op) otherwise, so
 * this is always safe for the client to call speculatively.
 */
export async function claimDailyMission(
  prisma: PrismaClient,
  userId: string,
  now: Date = new Date(),
): Promise<{ chipsAwarded: number; newChipBalance: number } | null> {
  const progress = await getDailyProgress(prisma, userId, now);
  if (!progress.canClaim) return null;

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      chipBalance: { increment: DAILY_MISSION_REWARD_CHIPS },
      dailyMissionClaimedDate: toUtcMidnight(now),
    },
    select: { chipBalance: true },
  });

  return { chipsAwarded: DAILY_MISSION_REWARD_CHIPS, newChipBalance: updated.chipBalance };
}
