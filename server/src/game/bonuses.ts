import type { Meld } from "@desmoche/shared";
import { countMicoAbajo, countMicoArriba, hasMicoAbajo, hasMicoArriba } from "@desmoche/shared";

export { hasMicoAbajo, hasMicoArriba };

export interface BonusResult {
  micoAbajo: boolean;
  micoArriba: boolean;
  /** Extra owed by EACH loser, on top of the pot, in ante units. */
  extraPerLoser: number;
}

/**
 * Each qualifying Mico run pays its own extra — a hand with two Mico abajo
 * runs in different suits (e.g. A-2-3 of clubs AND A-2-3 of hearts, both
 * placed in the same winning hand) pays DOUBLE, not once. Reported bug: this
 * used to cap at 1 extra per TYPE (abajo/arriba), so a second Mico of the
 * same type in a different suit paid nothing extra.
 */
export function calculateBonuses(winningMelds: Meld[], ante: number): BonusResult {
  const micoAbajoCount = countMicoAbajo(winningMelds);
  const micoArribaCount = countMicoArriba(winningMelds);
  return {
    micoAbajo: micoAbajoCount > 0,
    micoArriba: micoArribaCount > 0,
    extraPerLoser: (micoAbajoCount + micoArribaCount) * ante,
  };
}
