import { createDeck, type Card } from "@desmoche/shared";

export type Rng = () => number;

/** Fisher-Yates shuffle. `rng` is injectable for deterministic tests. */
export function shuffle(cards: Card[], rng: Rng = Math.random): Card[] {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = result[i]!;
    result[i] = result[j]!;
    result[j] = tmp;
  }
  return result;
}

export interface DealResult {
  hands: Card[][];
  stock: Card[];
  discard: Card[];
}

const HAND_SIZE = 9;

/**
 * Deals 9 cards to each player from an already-shuffled deck, then flips
 * one card to start the discard pile. The remainder is the stock.
 */
export function deal(shuffledDeck: Card[], playerCount: number): DealResult {
  if (playerCount < 2 || playerCount > 4) {
    throw new Error("Desmoche se juega con 2, 3 o 4 jugadores");
  }
  const required = playerCount * HAND_SIZE + 1;
  if (shuffledDeck.length < required) {
    throw new Error("Mazo insuficiente para repartir");
  }

  const hands: Card[][] = Array.from({ length: playerCount }, () => []);
  let cursor = 0;
  for (let round = 0; round < HAND_SIZE; round++) {
    for (let p = 0; p < playerCount; p++) {
      hands[p]!.push(shuffledDeck[cursor]!);
      cursor++;
    }
  }

  const discard = [shuffledDeck[cursor]!];
  cursor++;
  const stock = shuffledDeck.slice(cursor);

  return { hands, stock, discard };
}

export function buildShuffledDeck(rng: Rng = Math.random): Card[] {
  return shuffle(createDeck(), rng);
}
