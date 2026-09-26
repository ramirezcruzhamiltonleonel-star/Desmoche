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

// Nicaragua is UTC-6 year-round (no DST) — shifting the real timestamp back
// 6 hours before bucketing by UTC calendar day gives the MANAGUA calendar
// day for any instant. Streaks/missions used to cut over at UTC midnight
// (6pm in Managua, the middle of a normal evening play session — a
// reported bug: a streak could reset, or a mission could "expire," mid-way
// through the same real evening of play for a Nicaraguan player).
const MANAGUA_UTC_OFFSET_HOURS = 6;

function managuaShifted(d: Date): Date {
  return new Date(d.getTime() - MANAGUA_UTC_OFFSET_HOURS * 60 * 60 * 1000);
}

export function toManaguaMidnight(d: Date): Date {
  const shifted = managuaShifted(d);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

export function isSameManaguaDay(a: Date, b: Date): boolean {
  return toManaguaMidnight(a).getTime() === toManaguaMidnight(b).getTime();
}

function dayOfYearManagua(d: Date): number {
  const shifted = managuaShifted(d);
  const start = Date.UTC(shifted.getUTCFullYear(), 0, 1);
  return Math.floor((Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - start) / 86_400_000);
}

/** Deterministic per Managua calendar day — every user sees the same mission on the same day. */
export function missionForDate(now: Date = new Date()): DailyMissionDef {
  return MISSIONS[dayOfYearManagua(now) % MISSIONS.length]!;
}
