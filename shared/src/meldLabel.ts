import { RANK_ORDER } from "./cards";
import type { Meld } from "./melds";

const SUIT_SYMBOL = { spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣" } as const;

/**
 * A label unique across the WHOLE table, not just "Tercia (3)" /
 * "Escalera (3)" — with 2+ groups sharing the same type and card count,
 * those were indistinguishable (only ever worked because exactly one was
 * enabled at a time; genuinely ambiguous the moment two different groups
 * could both accept the same card — reported in an audit). A set's rank is
 * always unique across the whole game (only 4 cards of any rank exist,
 * enough for exactly one possible set); a run is identified by its suit and
 * its own span.
 */
export function meldLabel(meld: Meld): string {
  if (meld.type === "set") {
    const rank = meld.cards[0]?.rank ?? "?";
    return `Tercia de ${rank} (${meld.cards.length})`;
  }

  // A run's Ace can be low (A-2-3, "Mico abajo") or high (Q-K-A, "Mico
  // arriba") — RANK_ORDER alone is always Ace-low, so sort Ace-high here
  // specifically when the run actually contains a King (the only case
  // where the card is being used as the high end).
  const isAceHigh = meld.cards.some((c) => c.rank === "A") && meld.cards.some((c) => c.rank === "K");
  const orderOf = (rank: Meld["cards"][number]["rank"]): number =>
    isAceHigh && rank === "A" ? RANK_ORDER.K + 1 : RANK_ORDER[rank];
  const sorted = [...meld.cards].sort((a, b) => orderOf(a.rank) - orderOf(b.rank));

  const suit = sorted[0]?.suit;
  const low = sorted[0]?.rank ?? "?";
  const high = sorted[sorted.length - 1]?.rank ?? "?";
  const symbol = suit ? SUIT_SYMBOL[suit] : "";
  return `Escalera ${symbol} ${low}-${high} (${meld.cards.length})`;
}
