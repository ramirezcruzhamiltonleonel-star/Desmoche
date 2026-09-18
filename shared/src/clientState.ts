import type { Card } from "./cards";
import type { Meld, StakeType } from "./melds";
import type { TableEvent } from "./tableEvents";

export type Phase =
  | "lobby"
  | "cambio"
  | "claim-window"
  | "turn-active"
  | "hand-over";

export interface ClientSeatView {
  seatIndex: number;
  playerId: string;
  displayName: string;
  connected: boolean;
  ready: boolean;
  cardCount: number;
  /**
   * Excluded from the CURRENT hand's turn rotation, claim windows, and
   * Cambio — either because they disconnected mid-hand or used "Retirarme
   * de la mano". Always false in the lobby and reset fresh every new hand
   * (a past hand's disconnect/retirement never carries over). Still counts
   * as a loser in that hand's settlement, same as anyone who didn't win.
   */
  inactiveThisHand: boolean;
  /** A fixed bot persona filling this seat, added by the table creator — never a real account. */
  isBot: boolean;
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
  /**
   * True for the hand-opening ritual: the initial flip and, if it goes
   * unclaimed, every subsequent single card revealed from the stock by the
   * same designated first-turn player (never for a normal in-hand discard).
   */
  isInitialFlip: boolean;
}

export interface ClientHandOutcome {
  reason: "peladia" | "cuatro-cuerpos" | "meld-out" | "discard-out" | "stock-exhausted";
  /** Null only for "stock-exhausted" — nobody won that hand, so there's no winning seat. */
  winnerSeatIndex: number | null;
  winningMelds: Meld[];
}

/** The actual payout once a hand ends — null until settlement is computed (immediately after hand-over). */
export type ClientHandSettlement =
  | { kind: "chips" | "money"; winnerId: string; potWon: number; extraPerLoser: Record<string, number> }
  | { kind: "dare"; winnerId: string; playersWhoOweADare: string[] }
  | {
      /**
       * The mazo agotado ("se va doble") case: nobody won, so nothing is
       * paid out this hand. Chips/money only — dare mode has no pot to
       * carry, so this always carries addedToPot 0 there.
       */
      kind: "carry-over";
      addedToPot: number;
      totalAccumulatedPot: number;
    };

/** One completed hand's outcome, kept for the lifetime of the current table session (not persisted history — just this sitting). */
export interface ClientHandHistoryEntry {
  reason: ClientHandOutcome["reason"];
  winnerSeatIndex: number | null;
  settlement: ClientHandSettlement;
  playedAt: number;
}

/**
 * Everything a single connected player is allowed to see. Other players'
 * hands are reduced to a card count.
 */
export interface ClientGameState {
  code: string;
  stakeType: StakeType;
  ante: number;
  /** "Modo sin automáticas": when false, Peladía/Cuatro Cuerpos never end a hand early — every deal is played out normally. Fixed for the table's lifetime. */
  autoWinsEnabled: boolean;
  phase: Phase;
  seats: ClientSeatView[];
  yourSeatIndex: number | null;
  /** Watching without a seat — every UI affordance for acting (hand tray, ActionBar, Cambio, retiring) should stay hidden. */
  isSpectator: boolean;
  yourHand: Card[];
  melds: Meld[];
  stockCount: number;
  topDiscard: Card | null;
  dealerSeatIndex: number;
  turnSeatIndex: number;
  hasDrawnThisTurn: boolean;
  mustPlaceCard: Card | null;
  /**
   * A card just drawn from the stock that must be used in a meld or
   * discarded outright right away — it never becomes a free choice among
   * the original 9. Only ever populated for the player who drew it.
   */
  pendingDrawnCard: Card | null;
  cambio: ClientCambioView | null;
  yourCambioSubmitted: boolean;
  claim: ClientClaimView | null;
  /** Chips/money only: pot carried over from hand(s) that ended with no winner ("se va doble"), not yet paid out. 0 otherwise. */
  accumulatedPot: number;
  handOutcome: ClientHandOutcome | null;
  handSettlement: ClientHandSettlement | null;
  /** Every hand settled so far in this table session, oldest first. */
  handHistory: ClientHandHistoryEntry[];
  /** Notable in-hand moments (discard claims, desmoches, Peladía/Cuatro Cuerpos) for the whole table session, oldest first — filterable by type in the UI. */
  eventLog: TableEvent[];
}
