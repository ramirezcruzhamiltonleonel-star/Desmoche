import { hasMicoAbajo, hasMicoArriba } from "./bonuses";
import { hasCorazon, hasFlor, hasOro } from "./sidebets";
import type { ClientHandOutcome, ClientHandSettlement } from "./clientState";

export type BonusKind = "peladia" | "cuatro-cuerpos" | "mico" | "patona" | "oro" | "corazon" | "flor";

/**
 * Every bonus kind that fired on this specific hand's outcome — used to
 * decide which ones deserve a first-time-this-session explanation instead
 * of the normal compact display. Peladía/Cuatro Cuerpos come straight from
 * the outcome reason; Mico and the side bets (Oro/Corazón/Flor) are
 * detected from the winning melds themselves (the same checks the server
 * used to award them); Patona needs the settlement (only meaningful for a
 * real chips/money payout with at least one loser who placed nothing all
 * hand).
 */
export function bonusesAppliedThisHand(
  outcome: ClientHandOutcome,
  settlement: ClientHandSettlement | null,
): BonusKind[] {
  const applied: BonusKind[] = [];

  if (outcome.reason === "peladia") applied.push("peladia");
  if (outcome.reason === "cuatro-cuerpos") applied.push("cuatro-cuerpos");
  if (hasMicoAbajo(outcome.winningMelds) || hasMicoArriba(outcome.winningMelds)) applied.push("mico");
  if (hasOro(outcome.winningMelds)) applied.push("oro");
  if (hasCorazon(outcome.winningMelds)) applied.push("corazon");
  if (hasFlor(outcome.winningMelds)) applied.push("flor");
  if (settlement && (settlement.kind === "chips" || settlement.kind === "money") && settlement.patonaLoserIds.length > 0) {
    applied.push("patona");
  }

  return applied;
}
