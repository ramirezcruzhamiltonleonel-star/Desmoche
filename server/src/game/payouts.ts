import type { StakeType } from "@desmoche/shared";
import type { BonusResult } from "./bonuses";

export interface HandOutcomeInput {
  stakeType: StakeType;
  ante: number;
  winnerId: string;
  loserIds: string[];
  bonuses: BonusResult;
  /**
   * Patona: losers who placed zero melds during the whole hand owe the
   * winner one extra ante, same amount as a Mico, stacking with it.
   * Chips/money only — ignored entirely in dare mode.
   */
  patonaLoserIds?: string[];
  /**
   * Chips/money only: pot carried over from previous "stock-exhausted"
   * hands ("se va doble"), added on top of this hand's own ante pot.
   */
  carriedOverPot?: number;
}

export interface ChipsOrMoneyPayout {
  kind: "chips" | "money";
  winnerId: string;
  /** Total collected pot (ante * total players) awarded to the winner. */
  potWon: number;
  /** Extra each loser individually owes the winner from Mico bonuses. */
  extraPerLoser: Record<string, number>;
}

export interface DarePayout {
  kind: "dare";
  winnerId: string;
  /** Every player who did not win must fulfill their dare. */
  playersWhoOweADare: string[];
}

/**
 * The mazo agotado ("se va doble") case: nobody won, so nothing is paid out
 * this hand — the pot just grows for whenever someone finally wins.
 */
export interface CarryOverPot {
  kind: "carry-over";
  /** How much this specific hand added to the pot (0 in dare mode — there's nothing to carry). */
  addedToPot: number;
  /** The full accumulated pot after adding this hand's share. */
  totalAccumulatedPot: number;
}

export type HandOutcome = ChipsOrMoneyPayout | DarePayout | CarryOverPot;

export function calculateHandOutcome(input: HandOutcomeInput): HandOutcome {
  const { stakeType, ante, winnerId, loserIds, bonuses, patonaLoserIds = [], carriedOverPot = 0 } = input;

  if (stakeType === "dare") {
    return {
      kind: "dare",
      winnerId,
      playersWhoOweADare: [...loserIds],
    };
  }

  const totalPlayers = loserIds.length + 1;
  const extraPerLoser: Record<string, number> = {};
  for (const loserId of loserIds) {
    const patona = patonaLoserIds.includes(loserId) ? ante : 0;
    extraPerLoser[loserId] = bonuses.extraPerLoser + patona;
  }

  return {
    kind: stakeType,
    winnerId,
    potWon: ante * totalPlayers + carriedOverPot,
    extraPerLoser,
  };
}
