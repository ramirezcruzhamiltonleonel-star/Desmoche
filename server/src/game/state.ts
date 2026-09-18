import type { Card, Meld, Phase, StakeType, TableEvent } from "@desmoche/shared";

export type { Phase };

export interface Seat {
  seatIndex: number;
  playerId: string;
  displayName: string;
  connected: boolean;
  /** Only meaningful during the 'lobby' phase, before the first hand is dealt. */
  ready: boolean;
}

export interface TableConfig {
  code: string;
  stakeType: StakeType;
  ante: number;
  /** false = "modo sin automáticas": Peladía/Cuatro Cuerpos never end a hand early, every deal is played out normally. Defaults to true (classic) wherever a config is built without specifying it. */
  autoWinsEnabled: boolean;
}

export interface ClaimWindowState {
  /** The card up for grabs — either a real discard, or the initial flip. */
  card: Card;
  /**
   * Seat used as the rotation reference point for priority. For a real
   * discard this is the discarder; for the initial flip it's the dealer.
   */
  referenceSeatIndex: number;
  /** Seats still allowed to act (dealt out of eligibleSeatIndices as they respond). */
  pendingSeatIndices: number[];
  claimedBy: number[];
  /** Seat that plays next if nobody claims — the normal next seat. */
  fallbackSeatIndex: number;
  /**
   * True for the hand-opening ritual: the initial flip and, if it goes
   * unclaimed, every subsequent single card revealed from the stock by the
   * same designated first-turn player (never for a normal in-hand discard).
   */
  isInitialFlip: boolean;
}

export interface CambioState {
  /** playerId -> the card they've handed over. Not resolved until everyone has submitted one. */
  submitted: Record<string, Card>;
}

export interface HandOutcomeSummary {
  reason: "peladia" | "cuatro-cuerpos" | "meld-out" | "discard-out" | "stock-exhausted";
  /** Null only for "stock-exhausted" — the deck ran out with nobody completing their hand. */
  winnerSeatIndex: number | null;
  winningMelds: Meld[];
}

export interface GameState {
  phase: Phase;
  seats: Seat[];
  hands: Record<string, Card[]>;
  melds: Meld[];
  stock: Card[];
  discard: Card[];
  dealerSeatIndex: number;
  turnSeatIndex: number;
  /** Set once the active player has drawn this turn. */
  hasDrawnThisTurn: boolean;
  /**
   * When the active player's drawn card came from the discard pile, it must
   * be placed into a meld before they may discard to end their turn.
   */
  mustPlaceCard: Card | null;
  /**
   * The single card just drawn from the stock — it never joins the
   * "original 9" for a free discard choice. The player must either place it
   * into a meld right away or discard exactly this card; no other action is
   * legal until it's resolved one way or the other.
   */
  pendingDrawnCard: Card | null;
  /** Present only during the 'cambio' phase, right after dealing and before the initial claim window. */
  cambio: CambioState | null;
  claim: ClaimWindowState | null;
  /**
   * Seats excluded from THIS hand's turn rotation, claim windows, and Cambio
   * — either disconnected mid-hand or voluntarily retired via retire().
   * Rebuilt from scratch (from current connection status) every startHand()
   * — a past hand's disconnect/retirement never carries into the next one.
   * Reconnecting mid-hand does NOT remove a seat from this list; they stay
   * out for the rest of the CURRENT hand and rejoin fresh next hand.
   */
  inactiveSeatIndices: number[];
  /**
   * Chips/money only: pot carried over from hand(s) that ended in
   * "stock-exhausted" ("se va doble"), added on top of the next hand's own
   * ante pot once someone actually wins. Reset to 0 the moment it's paid
   * out. Never reset by startHand() — it must survive across hands.
   */
  accumulatedPot: number;
  handOutcome: HandOutcomeSummary | null;
  /** Notable in-hand moments for the whole table session — never reset by startHand(), only starts empty when the Table itself is created. Filterable by type in the UI. */
  eventLog: TableEvent[];
}

export function seatOf(state: GameState, playerId: string): Seat {
  const seat = state.seats.find((s) => s.playerId === playerId);
  if (!seat) throw new Error("Jugador no está en la mesa");
  return seat;
}

export function handOf(state: GameState, playerId: string): Card[] {
  const hand = state.hands[playerId];
  if (!hand) throw new Error("Jugador no tiene mano repartida");
  return hand;
}
