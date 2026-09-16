import type { ClientHandHistoryEntry, ClientSeatView } from "@desmoche/shared";

export interface ScoreboardRow {
  playerId: string;
  displayName: string;
  handsWon: number;
  /** Net chip change so far this session — same math as the server's payout calculation. Meaningless in dare mode. */
  netChips: number;
}

/**
 * Purely a display computation over data already broadcast (handHistory) —
 * no extra round-trip. Mirrors server/src/game/payouts.ts's math exactly so
 * the numbers always agree with what actually got charged.
 */
export function computeScoreboard(
  handHistory: ClientHandHistoryEntry[],
  seats: ClientSeatView[],
  ante: number,
): ScoreboardRow[] {
  const handsWon: Record<string, number> = {};
  const netChips: Record<string, number> = {};
  for (const seat of seats) {
    handsWon[seat.playerId] = 0;
    netChips[seat.playerId] = 0;
  }

  for (const entry of handHistory) {
    const winnerSeat = seats.find((s) => s.seatIndex === entry.winnerSeatIndex);
    if (winnerSeat) handsWon[winnerSeat.playerId] = (handsWon[winnerSeat.playerId] ?? 0) + 1;

    if (entry.settlement.kind === "chips" || entry.settlement.kind === "money") {
      const { winnerId, potWon, extraPerLoser } = entry.settlement;
      let extrasTotal = 0;
      for (const [loserId, extra] of Object.entries(extraPerLoser)) {
        netChips[loserId] = (netChips[loserId] ?? 0) - ante - extra;
        extrasTotal += extra;
      }
      netChips[winnerId] = (netChips[winnerId] ?? 0) + (potWon - ante) + extrasTotal;
    }
  }

  return seats.map((seat) => ({
    playerId: seat.playerId,
    displayName: seat.displayName,
    handsWon: handsWon[seat.playerId] ?? 0,
    netChips: netChips[seat.playerId] ?? 0,
  }));
}
