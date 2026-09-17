/**
 * Counter-clockwise seat rotation — kept in sync BY HAND with the server's
 * canonical `nextSeat` (server/src/game/turnOrder.ts: "Turn order in
 * Desmoche runs counter-clockwise around the table, which we model as seat
 * indices increasing (mod playerCount)"), rather than imported from
 * @desmoche/shared: the shared package's runtime exports don't survive
 * Vite/Rollup's CJS interop (see sortHand.ts for the same workaround), so
 * only type-only imports cross that boundary safely. This one-line
 * invariant is covered server-side by turnOrder.test.ts
 * (`nextSeat(0, 4) === 1`, `nextSeat(3, 4) === 0`) — if that ever changes,
 * this must change with it, and there is nowhere else this can silently
 * drift since it's this exact formula, not a reimplementation.
 */
function nextSeat(fromSeatIndex: number, playerCount: number): number {
  return (fromSeatIndex + 1) % playerCount;
}

/**
 * Seats in dealing order: counter-clockwise starting right after the
 * dealer — the same direction and starting point (`nextSeat(dealer, n)`)
 * normal turn rotation already uses for the first turn of the hand.
 */
export function buildDealOrder(dealerSeatIndex: number, seatCount: number): number[] {
  const order: number[] = [];
  let seat = dealerSeatIndex;
  for (let i = 0; i < seatCount; i++) {
    seat = nextSeat(seat, seatCount);
    order.push(seat);
  }
  return order;
}

/**
 * A random partition of `total` into clumps of 1-3 cards, with no two
 * adjacent clumps the same size. Models a real dealer varying how many
 * cards go out per pass (sometimes one at a time, sometimes a little fan
 * of 2-3) instead of a robotic fixed rhythm — regenerated on every deal,
 * so it varies hand to hand too.
 */
export function randomBatchSizes(total: number): number[] {
  const sizes: number[] = [];
  let remaining = total;
  let prev = 0;
  while (remaining > 0) {
    const maxSize = Math.min(3, remaining);
    let candidates: number[] = [];
    for (let n = 1; n <= maxSize; n++) {
      if (n !== prev) candidates.push(n);
    }
    if (candidates.length === 0) candidates = [maxSize];
    const size = candidates[Math.floor(Math.random() * candidates.length)]!;
    sizes.push(size);
    remaining -= size;
    prev = size;
  }
  return sizes;
}
