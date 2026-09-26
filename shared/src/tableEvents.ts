import type { Card } from "./cards";
import type { MeldType } from "./melds";

/**
 * A filterable log of notable in-hand moments, accumulated for the whole
 * table session (never reset per hand) — separate from `handHistory`, which
 * only tracks each hand's final outcome. Carries nothing a player couldn't
 * already see live, so it's safe to hand to every client as-is.
 */
export type TableEvent =
  | { type: "claimed-discard"; seatIndex: number; card: Card }
  | { type: "desmocho"; seatIndex: number; card: Card }
  /** A card that, by itself, completed/extended a seat's already-placed meld — auto-attached, never offered as a claim at all. */
  | { type: "auto-extend"; seatIndex: number; card: Card }
  /** A seat's hand+melds total hit 10 from receiving an auto-extend (never their own turn) — the system immediately discards one arbitrary card on their behalf to bring them back to 9, exactly as if they'd closed a normal turn. */
  | { type: "forced-discard"; seatIndex: number; card: Card }
  | { type: "peladia"; seatIndex: number }
  | { type: "cuatro-cuerpos"; seatIndex: number }
  | { type: "meld-placed"; seatIndex: number; meldType: MeldType; cards: Card[] }
  | { type: "retired"; seatIndex: number };

export type TableEventType = TableEvent["type"];
