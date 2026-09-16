import type { Card } from "./cards";
import type { Meld, StakeType } from "./melds";

export type Phase =
  | "lobby"
  | "cambio"
  | "claim-window"
  | "first-turn-choice"
  | "turn-active"
  | "hand-over";

export interface ClientSeatView {
  seatIndex: number;
  playerId: string;
  displayName: string;
  connected: boolean;
  ready: boolean;
  cardCount: number;
}

/** Who has already handed over their Cambio card — never which card, since it's blind/simultaneous. */
export interface ClientCambioView {
  submittedSeatIndices: number[];
}

export interface ClientClaimView {
  card: Card;
  referenceSeatIndex: number;
  pendingSeatIndices: number[];
  claimedBy: number[];
  fallbackSeatIndex: number;
  isInitialFlip: boolean;
}

export interface ClientHandOutcome {
  reason: "peladia" | "cuatro-cuerpos" | "meld-out" | "discard-out";
  winnerSeatIndex: number;
  winningMelds: Meld[];
}

/** The actual payout once a hand ends — null until settlement is computed (immediately after hand-over). */
export type ClientHandSettlement =
  | { kind: "chips" | "money"; winnerId: string; potWon: number; extraPerLoser: Record<string, number> }
  | { kind: "dare"; winnerId: string; playersWhoOweADare: string[] };

/** One completed hand's outcome, kept for the lifetime of the current table session (not persisted history — just this sitting). */
export interface ClientHandHistoryEntry {
  reason: ClientHandOutcome["reason"];
  winnerSeatIndex: number;
  settlement: ClientHandSettlement;
  playedAt: number;
}

/**
 * Everything a single connected player is allowed to see. Other players'
 * hands are reduced to a card count; a pending first-turn double-draw choice
 * is only ever populated for the player making that choice.
 */
export interface ClientGameState {
  code: string;
  stakeType: StakeType;
  ante: number;
  phase: Phase;
  seats: ClientSeatView[];
  yourSeatIndex: number | null;
  yourHand: Card[];
  melds: Meld[];
  stockCount: number;
  topDiscard: Card | null;
  dealerSeatIndex: number;
  turnSeatIndex: number;
  hasDrawnThisTurn: boolean;
  mustPlaceCard: Card | null;
  /**
   * A card just drawn from the stock (or kept from the first-turn double
   * draw) that must be used in a meld or discarded outright right away — it
   * never becomes a free choice among the original 9. Only ever populated
   * for the player who drew it.
   */
  pendingDrawnCard: Card | null;
  yourFirstTurnChoice: [Card, Card] | null;
  cambio: ClientCambioView | null;
  yourCambioSubmitted: boolean;
  claim: ClientClaimView | null;
  isFirstTurn: boolean;
  handOutcome: ClientHandOutcome | null;
  handSettlement: ClientHandSettlement | null;
  /** Every hand settled so far in this table session, oldest first. */
  handHistory: ClientHandHistoryEntry[];
}
