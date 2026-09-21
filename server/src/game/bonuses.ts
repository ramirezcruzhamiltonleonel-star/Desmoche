import type { Meld } from "@desmoche/shared";
import { hasMicoAbajo, hasMicoArriba } from "@desmoche/shared";

export { hasMicoAbajo, hasMicoArriba };

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
