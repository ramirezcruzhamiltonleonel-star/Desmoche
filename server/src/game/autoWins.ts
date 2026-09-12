import { RANKS, SUITS, type Card, type Rank, type Suit } from "@desmoche/shared";
import { closestInRotation } from "./turnOrder";

const LOW_ACE_VALUE: Record<Rank, number> = RANKS.reduce(
  (acc, rank, i) => {
    acc[rank] = i + 1;
    return acc;
  },
  {} as Record<Rank, number>,
);
const HIGH_ACE_VALUE: Record<Rank, number> = { ...LOW_ACE_VALUE, A: 14 };

/**
 * Peladía: the dealt hand has no pair (2+ cards sharing a rank) and no run
 * fragment (2+ cards of the same suit that are rank-adjacent, Ace counted
 * both low and high). A hand meeting this is unplayable on its own, so it
 * wins the deal outright.
 */
export function isPeladia(hand: Card[]): boolean {
  const rankCounts = new Map<Rank, number>();
  for (const card of hand) {
    rankCounts.set(card.rank, (rankCounts.get(card.rank) ?? 0) + 1);
  }
  const hasPair = [...rankCounts.values()].some((count) => count >= 2);
  if (hasPair) return false;

  for (const suit of SUITS) {
    const sameSuit = hand.filter((c) => c.suit === suit);
    for (let i = 0; i < sameSuit.length; i++) {
      for (let j = i + 1; j < sameSuit.length; j++) {
        const a = sameSuit[i]!;
        const b = sameSuit[j]!;
        const lowDiff = Math.abs(LOW_ACE_VALUE[a.rank] - LOW_ACE_VALUE[b.rank]);
        const highDiff = Math.abs(HIGH_ACE_VALUE[a.rank] - HIGH_ACE_VALUE[b.rank]);
        if (lowDiff === 1 || highDiff === 1) return false;
      }
    }
  }

  return true;
}

/** Cuatro Cuerpos: all four suits of one rank dealt to a single hand. */
export function hasCuatroCuerpos(hand: Card[]): boolean {
  const suitsByRank = new Map<Rank, Set<Suit>>();
  for (const card of hand) {
    const set = suitsByRank.get(card.rank) ?? new Set<Suit>();
    set.add(card.suit);
    suitsByRank.set(card.rank, set);
  }
  return [...suitsByRank.values()].some((suits) => suits.size === 4);
}

/**
 * Among tied Cuatro Cuerpos candidates, the winner is the one seated closest
 * to the dealer's right. Play runs counter-clockwise, so the dealer's right
 * neighbor is the next seat in turn order (dealerIndex + 1).
 */
export function closestToDealerRight(
  dealerIndex: number,
  candidateSeatIndices: number[],
  playerCount: number,
): number {
  return closestInRotation(dealerIndex, candidateSeatIndices, playerCount);
}

export interface AutoWinCheck {
  peladiaSeatIndices: number[];
  cuatroCuerposSeatIndices: number[];
}

export function checkAutoWins(hands: Card[][]): AutoWinCheck {
  const peladiaSeatIndices: number[] = [];
  const cuatroCuerposSeatIndices: number[] = [];
  hands.forEach((hand, seatIndex) => {
    if (isPeladia(hand)) peladiaSeatIndices.push(seatIndex);
    if (hasCuatroCuerpos(hand)) cuatroCuerposSeatIndices.push(seatIndex);
  });
  return { peladiaSeatIndices, cuatroCuerposSeatIndices };
}
