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

function removeOneCard(cards: Card[], target: Card): Card[] {
  const targetId = cardId(target);
  let removed = false;
  return cards.filter((c) => {
    if (!removed && cardId(c) === targetId) {
      removed = true;
      return false;
    }
    return true;
  });
}

/**
 * Every way to extend `existingCards` with 0, 1, or 2 hand cards while
 * staying a single valid meld — the empty combo (no extension at all) is
 * always included first. Bajar de más nunca es obligatorio: a player can
 * keep a run/set only partly placed, holding the rest back in hand
 * indefinitely as a surprise, and choose to play some of those held-back
 * cards later as part of a DIFFERENT move (reported case: extending a
 * placed 6-7-8 with a held-back 5, right as part of resolving a claim that
 * only works via desmocharring the resulting group). This is what lets
 * that extension be considered without ever requiring it up front.
 */
export function meldExtensionCombos(existingCards: Card[], hand: Card[]): Card[][] {
  const combos: Card[][] = [[]];
  for (const size of [1, 2]) {
    for (const combo of combinations(hand, size)) {
      if (isValidMeld([...existingCards, ...combo])) combos.push(combo);
    }
  }
  return combos;
}

/**
 * Whether `card` becomes usable once combined with ONE card desmochado out
 * of one of the player's own melds — optionally after ALSO extending that
 * meld first with hand cards, all as part of the same move. E.g. holding a
 * run at 5-6-7 and a separate 9-10-J-Q run, claiming an 8 doesn't fit
 * anywhere on its own, but desmocharring the 9 out of the second run
 * (still leaving 10-J-Q valid) and combining it with the claimed 8 and a
 * hand 6/7 opens up a brand-new meld — or, extending a placed 6-7-8 with a
 * 5 still held in hand, THEN desmocharring the 8 out of the resulting
 * 5-6-7-8, to free it up for a brand-new group with the claimed card. A
 * card that ONLY serves this way — not immediately usable per
 * canUseDiscardImmediately — must still be claimable: the actual
 * extend+desmoche+placement already happens in one move via placeMeld's
 * `desmoche` param (with its own optional `extendWith`), this just answers
 * whether SOME such move exists before letting the claim through at all.
 */
export function canUseDiscardWithDesmoche(hand: Card[], card: Card, ownMelds: Meld[]): boolean {
  for (const sourceMeld of ownMelds) {
    for (const extendCombo of meldExtensionCombos(sourceMeld.cards, hand)) {
      const extended = [...sourceMeld.cards, ...extendCombo];
      const handAfterExtend = hand.filter((h) => !extendCombo.some((e) => cardId(e) === cardId(h)));
      for (const desmochedCard of extended) {
        if (!canDesmocharFrom(extended, desmochedCard)) continue;
        const remainingSource = removeOneCard(extended, desmochedCard);
        const meldsAfterDesmoche = ownMelds.map((m) =>
          m.id === sourceMeld.id ? { ...m, cards: remainingSource } : m,
        );
        const handPool = [...handAfterExtend, desmochedCard];
        if (canUseDiscardImmediately(handPool, card, meldsAfterDesmoche)) return true;
      }
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

/**
 * Same as canDesmocharAnyCardFrom, but ALSO considers extending the meld
 * first with hand cards (see meldExtensionCombos) — a meld sitting at
 * exactly 3 cards isn't desmochable as-is, but might become so once a
 * held-back hand card extends it. Used to gate which of the player's own
 * melds are even offered as a desmoche source, before they've picked
 * which hand cards (if any) they intend to use for that.
 */
export function canDesmocharAnyCardFromWithExtension(sourceMeldCards: Card[], hand: Card[]): boolean {
  for (const extendCombo of meldExtensionCombos(sourceMeldCards, hand)) {
    if (canDesmocharAnyCardFrom([...sourceMeldCards, ...extendCombo])) return true;
  }
  return false;
}

/**
 * Given a source meld, the specific card being desmochado out of it, and
 * whatever hand cards the player has selected for this move, figures out
 * which of those selected cards (if any) need to go into extending the
 * source meld FIRST versus which complete the brand-new meld alongside the
 * desmochado card — the player just selects everything relevant together
 * (same as any other move in this game), and this resolves the split.
 * Tries the simplest solution first (no extension at all — combo size 0),
 * matching the original, narrower behavior when no extension is needed.
 * Returns null if no valid split exists at all.
 */
export function resolveDesmocheExtension(
  sourceMeldCards: Card[],
  desmochedCard: Card,
  selectedCards: Card[],
): { extendWith: Card[]; newMeldCards: Card[] } | null {
  for (const extendCombo of meldExtensionCombos(sourceMeldCards, selectedCards)) {
    const extended = [...sourceMeldCards, ...extendCombo];
    if (!canDesmocharFrom(extended, desmochedCard)) continue;
    const newMeldCards = selectedCards.filter((c) => !extendCombo.some((e) => cardId(e) === cardId(c)));
    if (isValidMeld([...newMeldCards, desmochedCard])) {
      return { extendWith: extendCombo, newMeldCards };
    }
  }
  return null;
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
