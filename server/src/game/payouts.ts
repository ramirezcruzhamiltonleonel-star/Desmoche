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

export type HandOutcome = ChipsOrMoneyPayout | DarePayout;

export function calculateHandOutcome(input: HandOutcomeInput): HandOutcome {
  const { stakeType, ante, winnerId, loserIds, bonuses, patonaLoserIds = [] } = input;

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
    potWon: ante * totalPlayers,
    extraPerLoser,
  };
}
