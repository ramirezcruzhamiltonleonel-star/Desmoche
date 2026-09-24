import type { Meld } from "@desmoche/shared";
import {
  countMicoAbajo,
  countMicoArriba,
  hasCorazon,
  hasFlor,
  hasMicoAbajo,
  hasMicoArriba,
  hasOro,
} from "@desmoche/shared";

export { hasMicoAbajo, hasMicoArriba, hasOro, hasCorazon, hasFlor };

export interface BonusResult {
  micoAbajo: boolean;
  micoArriba: boolean;
  /** Side bets de casa — see shared/sidebets.ts for the exact detection rule of each. */
  oro: boolean;
  corazon: boolean;
  flor: boolean;
  /** Extra owed by EACH loser, on top of the pot, in ante units. */
  extraPerLoser: number;
}

/**
 * Each qualifying Mico run pays its own extra — a hand with two Mico abajo
 * runs in different suits (e.g. A-2-3 of clubs AND A-2-3 of hearts, both
 * placed in the same winning hand) pays DOUBLE, not once. Side bets de casa
 * (Oro, Corazón, Flor) are independent bonuses that stack on top of Mico
 * and on top of each other — an all-diamonds close, for instance, pays
 * both Oro (2x ante) AND Flor (1.5x ante) at once, since Oro's condition is
 * a strict special case of Flor's ("same suit, specifically diamonds" vs
 * "same suit, any suit").
 */
export function calculateBonuses(winningMelds: Meld[], ante: number): BonusResult {
  const micoAbajoCount = countMicoAbajo(winningMelds);
  const micoArribaCount = countMicoArriba(winningMelds);
  const oro = hasOro(winningMelds);
  const corazon = hasCorazon(winningMelds);
  const flor = hasFlor(winningMelds);

  let extraPerLoser = (micoAbajoCount + micoArribaCount) * ante;
  if (oro) extraPerLoser += ante * 2;
  if (corazon) extraPerLoser += ante * 2;
  if (flor) extraPerLoser += Math.round(ante * 1.5);

  return {
    micoAbajo: micoAbajoCount > 0,
    micoArriba: micoArribaCount > 0,
    oro,
    corazon,
    flor,
    extraPerLoser,
  };
}
