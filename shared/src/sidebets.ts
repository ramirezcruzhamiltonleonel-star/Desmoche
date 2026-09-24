import type { Card } from "./cards";
import type { Meld } from "./melds";

type Suit = Card["suit"];

/**
 * Whether the ENTIRE winning play is escaleras (runs), all of the given
 * suit — no tercia anywhere (a tercia by rule needs 3 different suits, so
 * it can never itself be single-suit) and no escalera of any other suit.
 * Empty winningMelds (Peladía/Cuatro Cuerpos auto-wins, which never place
 * a single meld) never qualifies.
 */
function isAllEscalerasOfSuit(winningMelds: Meld[], suit: Suit): boolean {
  if (winningMelds.length === 0) return false;
  return winningMelds.every((m) => m.type === "run" && m.cards.every((c) => c.suit === suit));
}

/** Oro: closes the hand using ONLY escaleras of diamonds (oro). */
export function hasOro(winningMelds: Meld[]): boolean {
  return isAllEscalerasOfSuit(winningMelds, "diamonds");
}

/** Corazón: closes the hand using ONLY escaleras of hearts (corazones). */
export function hasCorazon(winningMelds: Meld[]): boolean {
  return isAllEscalerasOfSuit(winningMelds, "hearts");
}

/**
 * Flor: closes the hand using ONLY escaleras, all of the SAME suit —
 * whichever suit that happens to be (Oro and Corazón are the diamond- and
 * heart-specific cases of this same shape; a same-suit close in spades or
 * clubs qualifies for Flor alone).
 */
export function hasFlor(winningMelds: Meld[]): boolean {
  if (winningMelds.length === 0) return false;
  const suit = winningMelds[0]!.cards[0]?.suit;
  if (!suit) return false;
  return isAllEscalerasOfSuit(winningMelds, suit);
}
