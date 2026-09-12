import type { Card } from "./cards";
import type { Meld, StakeType } from "./melds";

export type Phase =
  | "lobby"
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
  yourFirstTurnChoice: [Card, Card] | null;
  claim: ClientClaimView | null;
  isFirstTurn: boolean;
  handOutcome: ClientHandOutcome | null;
  handSettlement: ClientHandSettlement | null;
}
