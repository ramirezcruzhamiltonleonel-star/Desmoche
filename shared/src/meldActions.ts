import { cardId, type Card } from "./cards";
import type { Meld } from "./melds";
import { combinations } from "./combinations";
import { canExtendMeld, isValidMeld } from "./meldRules";

/**
 * Whether `card` (candidate to draw from the discard pile) can be put to
 * immediate use: as part of a brand-new valid meld built from the player's
 * hand, to extend one of the player's own melds on its own, OR combined with
 * some hand cards to extend one of the player's own melds together in one
 * move (e.g. a meld sitting at 9-10-J, claiming a K while already holding
 * the connecting Q — neither the K alone nor the Q alone extends the meld,
 * but claiming the K and placing both together does). Without that last
 * case, a genuinely immediate-use card was refused as "doesn't serve you
 * right now" purely because the check only ever tried the claimed card by
 * itself against each meld. This must be checked BEFORE the draw is allowed
 * — a discard pickup that can't be used right away is illegal.
 */
export function canUseDiscardImmediately(
  hand: Card[],
  card: Card,
  ownMelds: Meld[],
): boolean {
  for (const meld of ownMelds) {
    if (canExtendMeld(meld.cards, card)) return true;
    for (const size of [1, 2]) {
      for (const combo of combinations(hand, size)) {
        if (isValidMeld([...meld.cards, card, ...combo])) return true;
      }
    }
  }

  for (const size of [2, 3]) {
    for (const combo of combinations(hand, size)) {
      if (isValidMeld([...combo, card])) return true;
    }
  }

  return false;
}

/**
 * Whether `card` becomes usable once combined with ONE card desmochado out
 * of one of the player's own melds — e.g. holding a run at 5-6-7 and a
 * separate 9-10-J-Q run, claiming an 8 doesn't fit anywhere on its own, but
 * desmocharring the 9 out of the second run (still leaving 10-J-Q valid)
 * and combining it with the claimed 8 and a hand 6/7 opens up a brand-new
 * meld. A card that ONLY serves this way — not immediately usable per
 * canUseDiscardImmediately — must still be claimable: the actual desmoche +
 * placement already happens in one move via placeMeld's `desmoche` param,
 * this just answers whether SOME such move exists before letting the claim
 * through in the first place.
 */
export function canUseDiscardWithDesmoche(hand: Card[], card: Card, ownMelds: Meld[]): boolean {
  for (const sourceMeld of ownMelds) {
    for (const desmochedCard of sourceMeld.cards) {
      if (!canDesmocharFrom(sourceMeld.cards, desmochedCard)) continue;
      const remainingSource = sourceMeld.cards.filter((c) => cardId(c) !== cardId(desmochedCard));
      const meldsAfterDesmoche = ownMelds.map((m) =>
        m.id === sourceMeld.id ? { ...m, cards: remainingSource } : m,
      );
      const handWithDesmochedCard = [...hand, desmochedCard];
      if (canUseDiscardImmediately(handWithDesmochedCard, card, meldsAfterDesmoche)) return true;
    }
  }
  return false;
}

/**
 * Whether a discard is claimable at all right now — either it's usable
 * immediately, or a legal desmoche makes it usable. This is the actual
 * eligibility rule a claim must pass; canUseDiscardImmediately alone is too
 * narrow (see canUseDiscardWithDesmoche above).
 */
export function canClaimDiscard(hand: Card[], card: Card, ownMelds: Meld[]): boolean {
  return canUseDiscardImmediately(hand, card, ownMelds) || canUseDiscardWithDesmoche(hand, card, ownMelds);
}

/**
 * Desmoche: removing a card from an existing meld to reuse it elsewhere is
 * only legal if the source meld remains a fully valid combination afterward
 * — not merely 3+ cards. A run loses its middle card and keeps 3+ cards but
 * a gap (9-10-J-Q-K minus the 10 leaves 9-J-Q-K, no longer consecutive) is
 * NOT good enough; the source meld must still be melded on its own.
 */
export function canDesmocharFrom(sourceMeldCards: Card[], removedCard: Card): boolean {
  const removedId = cardId(removedCard);
  let removed = false;
  const remaining = sourceMeldCards.filter((c) => {
    if (!removed && cardId(c) === removedId) {
      removed = true;
      return false;
    }
    return true;
  });
  return remaining.length >= 3 && isValidMeld(remaining);
}

/**
 * Whether ANY single card in this meld could be desmochado without
 * breaking it — used to gate desmoche UI before a specific card has been
 * chosen yet (e.g. "is this meld even eligible as a desmoche source").
 */
export function canDesmocharAnyCardFrom(sourceMeldCards: Card[]): boolean {
  return sourceMeldCards.some((card) => canDesmocharFrom(sourceMeldCards, card));
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
