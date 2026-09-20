import type { ClientGameState } from "./clientState";

export interface GuestSessionSummary {
  gamesPlayed: number;
  gamesWon: number;
  /**
   * The biggest single hand's NET chip gain this session (pot won, minus
   * the ante the winner themselves put in, plus any Mico/Patona bonus) —
   * the same figure the session scoreboard shows, not the raw pot total.
   * Regression: this used to be `settlement.potWon` directly, which
   * double-counts the winner's own ante — a hand with a 400-chip pot
   * (4 players x 100 ante) nets the winner +300, but this showed "+400",
   * disagreeing with the scoreboard's own "+300" for the exact same hand.
   * Null if no chips-mode win happened.
   */
  bestWinChips: number | null;
}

/** Computed purely from this session's in-memory handHistory — nothing here is ever persisted for a guest. */
export function computeGuestSummary(state: ClientGameState): GuestSessionSummary {
  let gamesWon = 0;
  let bestWinChips: number | null = null;

  for (const entry of state.handHistory) {
    if (entry.winnerSeatIndex !== state.yourSeatIndex) continue;
    gamesWon += 1;
    if (entry.settlement.kind === "chips" || entry.settlement.kind === "money") {
      const extrasTotal = Object.values(entry.settlement.extraPerLoser).reduce((sum, extra) => sum + extra, 0);
      const netGain = entry.settlement.potWon - state.ante + extrasTotal;
      if (bestWinChips === null || netGain > bestWinChips) {
        bestWinChips = netGain;
      }
    }
  }

  return { gamesPlayed: state.handHistory.length, gamesWon, bestWinChips };
}
