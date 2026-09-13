import type { Card, Meld, Phase, StakeType } from "@desmoche/shared";

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
  /** True only for the very first flip of the hand. */
  isInitialFlip: boolean;
}

export interface CambioState {
  /** playerId -> the card they've handed over. Not resolved until everyone has submitted one. */
  submitted: Record<string, Card>;
}

export interface HandOutcomeSummary {
  reason: "peladia" | "cuatro-cuerpos" | "meld-out" | "discard-out";
  winnerSeatIndex: number;
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
   * The single card just drawn from the STOCK (normal draw, or the kept half
   * of a first-turn double draw) — it never joins the "original 9" for a
   * free discard choice. The player must either place it into a meld right
   * away or discard exactly this card; no other action is legal until it's
   * resolved one way or the other.
   */
  pendingDrawnCard: Card | null;
  /** Present only while resolving a first-turn double stock draw. */
  firstTurnChoice: [Card, Card] | null;
  /** Present only during the 'cambio' phase, right after dealing and before the initial claim window. */
  cambio: CambioState | null;
  claim: ClaimWindowState | null;
  isFirstTurn: boolean;
  handOutcome: HandOutcomeSummary | null;
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
