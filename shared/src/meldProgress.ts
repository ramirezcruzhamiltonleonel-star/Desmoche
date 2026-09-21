import type { Card } from "./cards";
import type { Meld } from "./melds";

export interface MeldProgress {
  /** Cards already sitting in one of the player's own melds on the table. */
  meldedCount: number;
  /** meldedCount + hand.length — the player's full 9-or-10-card hand for this moment (10 right after a stock draw, until it's resolved). */
  totalCount: number;
  /** meldedCount / totalCount, 0 when totalCount is 0 (shouldn't happen in a real hand, but avoids a division by zero). */
  fraction: number;
}

/**
 * A simple, always-accurate progress signal — not an attempt to solve "how
 * many MORE groups do you need", which is a real combinatorial optimization
 * problem (a card can validly belong to more than one candidate group, so
 * the true minimum isn't just arithmetic). Counting cards already melded
 * out of the player's full hand is honest and cheap, and was explicitly
 * offered as the simpler alternative.
 */
export function computeMeldProgress(hand: Card[], ownMelds: Meld[]): MeldProgress {
  const meldedCount = ownMelds.reduce((sum, meld) => sum + meld.cards.length, 0);
  const totalCount = meldedCount + hand.length;
  return {
    meldedCount,
    totalCount,
    fraction: totalCount > 0 ? meldedCount / totalCount : 0,
  };
}
