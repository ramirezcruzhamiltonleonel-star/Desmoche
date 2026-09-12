/**
 * Turn order in Desmoche runs counter-clockwise around the table, which we
 * model as seat indices increasing (mod playerCount). "Closest to X's right"
 * and "next claimant in rotation after a discard" are both the same
 * operation: find the candidate reachable soonest by stepping forward from a
 * reference seat.
 */
export function closestInRotation(
  fromSeatIndex: number,
  candidateSeatIndices: number[],
  playerCount: number,
): number {
  if (candidateSeatIndices.length === 0) {
    throw new Error("No candidates provided");
  }
  const candidates = new Set(candidateSeatIndices);
  for (let step = 1; step <= playerCount; step++) {
    const seat = (fromSeatIndex + step) % playerCount;
    if (candidates.has(seat)) return seat;
  }
  throw new Error("Unreachable: candidate not found in rotation");
}

export function nextSeat(fromSeatIndex: number, playerCount: number): number {
  return (fromSeatIndex + 1) % playerCount;
}
