import type { Card, Meld } from "@desmoche/shared";

// Kept local rather than importing from @desmoche/shared or the server's
// game/melds.ts: the client never depends on server code, and shared's
// runtime exports don't survive Vite/Rollup's CJS interop anyway (see
// sortHand.ts for the same workaround) — these are tiny, stable lookup
// tables duplicating the same ace-high/ace-low logic melds.ts already uses
// to validate a run, only here to decide how to DISPLAY one.
const LOW_ACE_VALUE: Record<Card["rank"], number> = {
  A: 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
};
const HIGH_ACE_VALUE: Record<Card["rank"], number> = { ...LOW_ACE_VALUE, A: 14 };

const BLACK_SUITS = new Set<Card["suit"]>(["spades", "clubs"]);
// Suit priority within each color — arbitrary but fixed, just for a stable display order.
const BLACK_SUIT_PRIORITY: Record<string, number> = { spades: 0, clubs: 1 };
const RED_SUIT_PRIORITY: Record<string, number> = { hearts: 0, diamonds: 1 };

function isConsecutive(values: number[]): boolean {
  const sorted = [...values].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1]! + 1) return false;
  }
  return true;
}

/** Ascending order — as low ace (A-2-3...) unless that isn't consecutive, in which case ace reads high (...Q-K-A). */
function sortRunForDisplay(cards: Card[]): Card[] {
  const asLow = cards.map((c) => LOW_ACE_VALUE[c.rank]);
  const valueOf = isConsecutive(asLow) ? LOW_ACE_VALUE : HIGH_ACE_VALUE;
  return [...cards].sort((a, b) => valueOf[a.rank] - valueOf[b.rank]);
}

/**
 * Alternates black/red as evenly as possible (e.g. black-red-black for a
 * 3-card set, black-red-black-red for a 4-card set) instead of letting
 * same-color cards cluster together based on the order they were added.
 */
function sortSetForDisplay(cards: Card[]): Card[] {
  const black = cards
    .filter((c) => BLACK_SUITS.has(c.suit))
    .sort((a, b) => BLACK_SUIT_PRIORITY[a.suit]! - BLACK_SUIT_PRIORITY[b.suit]!);
  const red = cards
    .filter((c) => !BLACK_SUITS.has(c.suit))
    .sort((a, b) => RED_SUIT_PRIORITY[a.suit]! - RED_SUIT_PRIORITY[b.suit]!);

  const [majority, minority] = black.length >= red.length ? [black, red] : [red, black];
  const result: Card[] = [];
  for (let i = 0; i < majority.length; i++) {
    result.push(majority[i]!);
    if (i < minority.length) result.push(minority[i]!);
  }
  return result;
}

/**
 * Purely visual: how a meld's cards are laid out on the table so a group is
 * easy to read at a glance, regardless of the order cards were added to it
 * (dealt, placed, extended, or desmochado in). Never affects what counts as
 * a valid meld — only display order.
 */
export function sortMeldCardsForDisplay(meld: Meld): Card[] {
  return meld.type === "run" ? sortRunForDisplay(meld.cards) : sortSetForDisplay(meld.cards);
}
