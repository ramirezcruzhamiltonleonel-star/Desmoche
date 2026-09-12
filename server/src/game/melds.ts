import { cardId, type Card, type Rank } from "@desmoche/shared";

const LOW_ACE_VALUE: Record<Rank, number> = {
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

const HIGH_ACE_VALUE: Record<Rank, number> = { ...LOW_ACE_VALUE, A: 14 };

function hasUniqueCards(cards: Card[]): boolean {
  const ids = new Set(cards.map(cardId));
  return ids.size === cards.length;
}

/** Tercia/póker: 3 or 4 cards of the same rank, all of different suits. */
export function isValidSet(cards: Card[]): boolean {
  if (cards.length !== 3 && cards.length !== 4) return false;
  if (!hasUniqueCards(cards)) return false;

  const rank = cards[0]!.rank;
  if (!cards.every((c) => c.rank === rank)) return false;

  const suits = new Set(cards.map((c) => c.suit));
  return suits.size === cards.length;
}

function isConsecutiveRun(cards: Card[], valueOf: Record<Rank, number>): boolean {
  const values = cards.map((c) => valueOf[c.rank]).sort((a, b) => a - b);
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== values[i - 1]! + 1) return false;
  }
  return true;
}

/**
 * Escalera: 3+ consecutive cards of the same suit. Ace may act as low (A-2-3)
 * or high (Q-K-A) but never both within the same run (no K-A-2 wraparound).
 */
export function isValidRun(cards: Card[]): boolean {
  if (cards.length < 3) return false;
  if (!hasUniqueCards(cards)) return false;

  const suit = cards[0]!.suit;
  if (!cards.every((c) => c.suit === suit)) return false;

  return isConsecutiveRun(cards, LOW_ACE_VALUE) || isConsecutiveRun(cards, HIGH_ACE_VALUE);
}

export function isValidMeld(cards: Card[]): boolean {
  return isValidSet(cards) || isValidRun(cards);
}

/**
 * True if `card` can extend the existing meld (already valid on its own)
 * into another still-valid meld once added.
 */
export function canExtendMeld(existing: Card[], card: Card): boolean {
  return isValidMeld([...existing, card]);
}
