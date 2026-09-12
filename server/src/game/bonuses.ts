import type { Card } from "@desmoche/shared";
import type { Meld } from "@desmoche/shared";

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

export interface BonusResult {
  micoAbajo: boolean;
  micoArriba: boolean;
  /** Extra owed by EACH loser, on top of the pot, in ante units. */
  extraPerLoser: number;
}

export function calculateBonuses(winningMelds: Meld[], ante: number): BonusResult {
  const micoAbajo = hasMicoAbajo(winningMelds);
  const micoArriba = hasMicoArriba(winningMelds);
  const bonusCount = (micoAbajo ? 1 : 0) + (micoArriba ? 1 : 0);
  return {
    micoAbajo,
    micoArriba,
    extraPerLoser: bonusCount * ante,
  };
}
