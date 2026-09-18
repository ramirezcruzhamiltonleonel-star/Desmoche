import type { Card } from "./cards";

/**
 * A filterable log of notable in-hand moments, accumulated for the whole
 * table session (never reset per hand) — separate from `handHistory`, which
 * only tracks each hand's final outcome. Carries nothing a player couldn't
 * already see live, so it's safe to hand to every client as-is.
 */
export type TableEvent =
  | { type: "claimed-discard"; seatIndex: number; card: Card }
  | { type: "desmocho"; seatIndex: number; card: Card }
  | { type: "peladia"; seatIndex: number }
  | { type: "cuatro-cuerpos"; seatIndex: number };

export type TableEventType = TableEvent["type"];
