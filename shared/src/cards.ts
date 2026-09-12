export const SUITS = ["spades", "hearts", "diamonds", "clubs"] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
] as const;
export type Rank = (typeof RANKS)[number];

/** Position of each rank in a fixed low-to-high sequence, Ace low (index 0). */
export const RANK_ORDER: Record<Rank, number> = RANKS.reduce(
  (acc, rank, index) => {
    acc[rank] = index;
    return acc;
  },
  {} as Record<Rank, number>,
);

export interface Card {
  rank: Rank;
  suit: Suit;
}

export function cardId(card: Card): string {
  return `${card.rank}-${card.suit}`;
}

export function cardsEqual(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}
