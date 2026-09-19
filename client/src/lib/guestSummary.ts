import type { ClientGameState } from "@desmoche/shared";

export interface GuestSessionSummary {
  gamesPlayed: number;
  gamesWon: number;
  /** The biggest single pot won this session, in chips. Null if no chips-mode win happened. */
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
      if (bestWinChips === null || entry.settlement.potWon > bestWinChips) {
        bestWinChips = entry.settlement.potWon;
      }
    }
  }

  return { gamesPlayed: state.handHistory.length, gamesWon, bestWinChips };
}
