/**
 * If nobody claims the very first flipped discard card, the first player
 * draws 2 cards from the stock instead of the usual 1 (keeps one, discards
 * the other) rather than drawing normally.
 */
export function firstTurnStockDrawCount(initialDiscardWasClaimed: boolean): number {
  return initialDiscardWasClaimed ? 1 : 2;
}
