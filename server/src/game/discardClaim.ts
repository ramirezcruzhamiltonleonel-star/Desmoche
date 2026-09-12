import { closestInRotation, nextSeat } from "./turnOrder";

/**
 * When a discarded card is useful to more than one player, priority goes to
 * whoever is closest in the counter-clockwise rotation to the player who
 * discarded it — not automatically the next player in turn order. Players
 * otherwise "tap the table" (pasar) to signal no interest.
 */
export function resolveDiscardClaimPriority(
  discarderSeatIndex: number,
  claimantSeatIndices: number[],
  playerCount: number,
): number {
  return closestInRotation(discarderSeatIndex, claimantSeatIndices, playerCount);
}

/**
 * Seat that plays next right after a discard. If someone claimed the card
 * out of turn, play jumps straight to them; otherwise it's the normal next
 * seat in rotation.
 */
export function seatToPlayAfterDiscard(
  currentTurnSeatIndex: number,
  claimWinnerSeatIndex: number | null,
  playerCount: number,
): number {
  if (claimWinnerSeatIndex !== null) return claimWinnerSeatIndex;
  return nextSeat(currentTurnSeatIndex, playerCount);
}

/**
 * Once a claimant finishes their full out-of-turn play, normal rotation
 * resumes from the seat after them — the players skipped over in between do
 * not get an extra turn.
 */
export function seatToPlayAfterClaimedTurn(
  claimantSeatIndex: number,
  playerCount: number,
): number {
  return nextSeat(claimantSeatIndex, playerCount);
}
