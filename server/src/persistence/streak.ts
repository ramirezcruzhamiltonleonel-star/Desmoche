import { toManaguaMidnight } from "./dailyMission";

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastPlayedDate: Date | null;
}

/**
 * Recomputes a user's play streak given they just played a hand "now".
 * Pure and DB-agnostic — the caller (persistence/handHistory.ts) is
 * responsible for reading the current state and writing the result back.
 *
 * Same calendar day (Managua time) as last time: no change — playing 5
 * hands in one day doesn't count 5x. Exactly one day later: streak
 * continues (+1). Anything else (a gap, or first time ever): streak
 * resets to 1.
 */
export function updateStreakForPlay(state: StreakState, now: Date = new Date()): StreakState {
  const today = toManaguaMidnight(now);

  if (!state.lastPlayedDate) {
    return { currentStreak: 1, longestStreak: Math.max(1, state.longestStreak), lastPlayedDate: today };
  }

  // state.lastPlayedDate is ALREADY a Managua-midnight bucket marker (the
  // `today` from some earlier call) — re-shifting it through
  // toManaguaMidnight a second time would incorrectly walk it back another
  // 6 hours into the PREVIOUS day's bucket. Use it as-is.
  const dayDiff = Math.round((today.getTime() - state.lastPlayedDate.getTime()) / 86_400_000);

  if (dayDiff === 0) return state;

  const newStreak = dayDiff === 1 ? state.currentStreak + 1 : 1;
  return {
    currentStreak: newStreak,
    longestStreak: Math.max(newStreak, state.longestStreak),
    lastPlayedDate: today,
  };
}
