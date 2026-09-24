import type { Card } from "./cards";
import type { Meld } from "./melds";

/**
 * Whether this run (same suit, 3+ cards) CONTAINS the given 3-rank
 * sequence — not just matches it exactly. A run's ranks are always
 * contiguous by construction, so a longer run whose ranks happen to
 * include all 3 target ranks necessarily contains them as a contiguous
 * sub-run at one end (e.g. A-2-3-4 contains A-2-3; J-Q-K-A contains
 * Q-K-A) — no separate adjacency check is needed once the ranks are all
 * present. Reported bug: this used to require length === 3 exactly, so a
 * longer run built right through the Mico sequence paid nothing.
 */
function containsRunOf(meld: Meld, ranksInOrder: readonly [string, string, string]): boolean {
  if (meld.type !== "run" || meld.cards.length < 3) return false;
  const suit = meld.cards[0]!.suit;
  if (!meld.cards.every((c: Card) => c.suit === suit)) return false;
  const ranks = new Set(meld.cards.map((c: Card) => c.rank));
  return ranksInOrder.every((r) => ranks.has(r as Card["rank"]));
}

/** How many of the winning melds are (or contain) a Mico abajo: A-2-3 same suit. */
export function countMicoAbajo(winningMelds: Meld[]): number {
  return winningMelds.filter((m) => containsRunOf(m, ["A", "2", "3"])).length;
}

/** How many of the winning melds are (or contain) a Mico arriba: Q-K-A same suit. */
export function countMicoArriba(winningMelds: Meld[]): number {
  return winningMelds.filter((m) => containsRunOf(m, ["Q", "K", "A"])).length;
}

/** Mico abajo: at least one A-2-3 run (or a longer run containing it), same suit, in the winning play. */
export function hasMicoAbajo(winningMelds: Meld[]): boolean {
  return countMicoAbajo(winningMelds) > 0;
}

/** Mico arriba: at least one Q-K-A run (or a longer run containing it), same suit, in the winning play. */
export function hasMicoArriba(winningMelds: Meld[]): boolean {
  return countMicoArriba(winningMelds) > 0;
}
