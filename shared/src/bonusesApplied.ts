import { hasMicoAbajo, hasMicoArriba } from "./bonuses";
import type { ClientHandOutcome, ClientHandSettlement } from "./clientState";

export type BonusKind = "peladia" | "cuatro-cuerpos" | "mico" | "patona";

/**
 * Every bonus kind that fired on this specific hand's outcome — used to
 * decide which ones deserve a first-time-this-session explanation instead
 * of the normal compact display. Peladía/Cuatro Cuerpos come straight from
 * the outcome reason; Mico is detected from the winning melds themselves
 * (the same check the server used to award it); Patona needs the
 * settlement (only meaningful for a real chips/money payout with at least
 * one loser who placed nothing all hand).
 */
export function bonusesAppliedThisHand(
  outcome: ClientHandOutcome,
  settlement: ClientHandSettlement | null,
): BonusKind[] {
  const applied: BonusKind[] = [];

  if (outcome.reason === "peladia") applied.push("peladia");
  if (outcome.reason === "cuatro-cuerpos") applied.push("cuatro-cuerpos");
  if (hasMicoAbajo(outcome.winningMelds) || hasMicoArriba(outcome.winningMelds)) applied.push("mico");
  if (settlement && (settlement.kind === "chips" || settlement.kind === "money") && settlement.patonaLoserIds.length > 0) {
    applied.push("patona");
  }

  return applied;
}
