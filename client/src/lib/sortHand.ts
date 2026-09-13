import type { Card } from "@desmoche/shared";

// Kept local rather than importing @desmoche/shared's SUITS/RANK_ORDER: the
// shared package builds to CommonJS for the server/Jest, and Vite/Rollup's
// CJS interop can't statically see runtime values re-exported through its
// barrel (`export * from "./cards"` compiles to a dynamic copy it can't
// trace). Type-only imports are unaffected since they're erased entirely —
// only this file needs the actual rank/suit order data, so it's duplicated
// here rather than fighting the bundler over it.
const SUIT_ORDER: Record<Card["suit"], number> = {
  spades: 0,
  hearts: 1,
  diamonds: 2,
  clubs: 3,
};

const RANK_ORDER: Record<Card["rank"], number> = {
  A: 0,
  "2": 1,
  "3": 2,
  "4": 3,
  "5": 4,
  "6": 5,
  "7": 6,
  "8": 7,
  "9": 8,
  "10": 9,
  J: 10,
  Q: 11,
  K: 12,
};

/**
 * Purely visual grouping for display — groups cards by suit (so a potential
 * run sits together) and orders by rank within each suit, so pairs/tercias
 * across suits are also easy to spot by their shared rank label. Never
 * changes the actual hand, never validates or suggests specific groups.
 */
export function sortHandForDisplay(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => {
    if (a.suit !== b.suit) return SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
    return RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
  });
}
