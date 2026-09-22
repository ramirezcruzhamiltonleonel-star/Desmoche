export type DailyMissionKey = "win-one" | "play-three";

export interface DailyMissionDef {
  key: DailyMissionKey;
  description: string;
  target: number;
}

/**
 * Two simple, always-solvable-alone missions (a bot table counts the same as
 * any other), rotated by day-of-year so the profile shows some variety
 * instead of the exact same line forever — deliberately not more elaborate
 * than this, both are derived straight from existing HandHistoryPlayer rows
 * with no new game-engine tracking needed.
 */
const MISSIONS: DailyMissionDef[] = [
  { key: "win-one", description: "Ganá 1 mano", target: 1 },
  { key: "play-three", description: "Jugá 3 manos", target: 3 },
];

/** Small enough to feel like a nudge, not a grind — matches the ask ("no hace falta que sea elaborado"). */
export const DAILY_MISSION_REWARD_CHIPS = 50;

function dayOfYearUtc(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start) / 86_400_000);
}

/** Deterministic per calendar day (UTC) — every user sees the same mission on the same day. */
export function missionForDate(now: Date = new Date()): DailyMissionDef {
  return MISSIONS[dayOfYearUtc(now) % MISSIONS.length]!;
}

export function toUtcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function isSameUtcDay(a: Date, b: Date): boolean {
  return toUtcMidnight(a).getTime() === toUtcMidnight(b).getTime();
}
