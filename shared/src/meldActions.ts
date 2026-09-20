import { cardId, type Card } from "./cards";
import type { Meld } from "./melds";
import { combinations } from "./combinations";
import { canExtendMeld, isValidMeld } from "./meldRules";

/**
 * Whether `card` (candidate to draw from the discard pile) can be put to
 * immediate use: either as part of a brand-new valid meld built from the
 * player's hand, or to extend one of the player's own melds already on the
 * table. This must be checked BEFORE the draw is allowed — a discard pickup
 * that can't be used right away is illegal.
 */
export function canUseDiscardImmediately(
  hand: Card[],
  card: Card,
  ownMelds: Meld[],
): boolean {
  if (ownMelds.some((meld) => canExtendMeld(meld.cards, card))) {
    return true;
  }

  for (const size of [2, 3]) {
    for (const combo of combinations(hand, size)) {
      if (isValidMeld([...combo, card])) return true;
    }
  }

  return false;
}

/**
 * Desmoche: removing a card from an existing meld to reuse it elsewhere is
 * only legal if the source meld keeps at least 3 cards afterward.
 */
export function canDesmocharFrom(sourceMeldCards: Card[]): boolean {
  return sourceMeldCards.length - 1 >= 3;
}

/** A player wins immediately when their whole hand (post-draw) is melded, nothing left to discard. */
export function isHandEmptied(remainingHand: Card[]): boolean {
  return remainingHand.length === 0;
}

/**
 * Every hand card that's part of AT LEAST ONE legal meld/extend move right
 * now — either it extends an own meld on its own, or it joins other hand
 * cards into a brand-new one. Used to highlight real options in the UI
 * instead of leaving the whole hand looking equally clickable until a move
 * gets rejected.
 *
 * `requiredCard`, when given (a pending stock-drawn or claimed card), must
 * be part of any candidate new-meld combo — mirrors the server's own
 * "resolve the pending card first" rule, so nothing gets highlighted that
 * would actually be refused.
 */
export function findPlayableCardIds(hand: Card[], ownMelds: Meld[], requiredCard: Card | null): Set<string> {
  const playable = new Set<string>();

  for (const card of hand) {
    if (ownMelds.some((meld) => canExtendMeld(meld.cards, card))) playable.add(cardId(card));
  }

  const candidates = requiredCard ? hand.filter((c) => cardId(c) !== cardId(requiredCard)) : hand;
  const comboSize = requiredCard ? 2 : 3;
  for (const combo of combinations(candidates, comboSize)) {
    const meld = requiredCard ? [requiredCard, ...combo] : combo;
    if (isValidMeld(meld)) {
      for (const c of meld) playable.add(cardId(c));
    }
  }

  return playable;
}
