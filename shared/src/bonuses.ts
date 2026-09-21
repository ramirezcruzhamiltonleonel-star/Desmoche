import type { Card } from "./cards";
import type { Meld } from "./melds";

function isRunOf(meld: Meld, ranksInOrder: [string, string, string]): boolean {
  if (meld.type !== "run" || meld.cards.length !== 3) return false;
  const suit = meld.cards[0]!.suit;
  if (!meld.cards.every((c: Card) => c.suit === suit)) return false;
  const ranks = new Set(meld.cards.map((c: Card) => c.rank));
  return ranksInOrder.every((r) => ranks.has(r as Card["rank"]));
}

/** Mico abajo: A-2-3 run of the same suit, as part of the winning play. */
export function hasMicoAbajo(winningMelds: Meld[]): boolean {
  return winningMelds.some((m) => isRunOf(m, ["A", "2", "3"]));
}

/** Mico arriba: Q-K-A run of the same suit, as part of the winning play. */
export function hasMicoArriba(winningMelds: Meld[]): boolean {
  return winningMelds.some((m) => isRunOf(m, ["Q", "K", "A"]));
}
