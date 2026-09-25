import { cardId, type Card } from "./cards";
import type { Meld } from "./melds";
import {
  canClaimDiscard,
  canDesmocharAnyCardFrom,
  canDesmocharAnyCardFromWithExtension,
  canDesmocharFrom,
  canUseDiscardImmediately,
  canUseDiscardWithDesmoche,
  findPlayableCardIds,
  isHandEmptied,
  resolveDesmocheExtension,
} from "./meldActions";

function c(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

describe("canUseDiscardImmediately", () => {
  it("allows the pickup when it completes a new set from the hand", () => {
    const hand = [c("8", "hearts"), c("8", "clubs"), c("2", "spades")];
    expect(canUseDiscardImmediately(hand, c("8", "diamonds"), [])).toBe(true);
  });

  it("allows the pickup when it completes a new run from the hand", () => {
    const hand = [c("5", "hearts"), c("6", "hearts"), c("2", "spades")];
    expect(canUseDiscardImmediately(hand, c("7", "hearts"), [])).toBe(true);
  });

  it("allows the pickup when it extends one of the player's own melds", () => {
    const ownMeld: Meld = {
      id: "m1",
      type: "run",
      ownerId: "p1",
      cards: [c("5", "hearts"), c("6", "hearts"), c("7", "hearts")],
    };
    const hand = [c("2", "spades")];
    expect(canUseDiscardImmediately(hand, c("8", "hearts"), [ownMeld])).toBe(true);
  });

  it("rejects the pickup when the card is dead", () => {
    const hand = [c("2", "spades"), c("9", "clubs"), c("K", "diamonds")];
    expect(canUseDiscardImmediately(hand, c("4", "hearts"), [])).toBe(false);
  });

  // Reported bug: neither the claimed card ALONE extends the meld (there's
  // a gap), nor do the hand cards alone form a valid brand-new meld with
  // it — but the claimed card TOGETHER WITH a hand card completes the same
  // existing meld. E.g. a run sitting at 9-10-J, holding a Q in hand,
  // someone discards a K: the K alone can't extend 9-10-J (skips the Q),
  // and Q+K alone isn't a valid 2-card meld — but claiming the K and
  // placing it with the Q extends the meld to 9-10-J-Q-K in one move.
  it("allows the pickup when it combines with a hand card to extend an own meld together", () => {
    const ownMeld: Meld = {
      id: "m1",
      type: "run",
      ownerId: "p1",
      cards: [c("9", "clubs"), c("10", "clubs"), c("J", "clubs")],
    };
    const hand = [c("Q", "clubs"), c("2", "spades")];
    expect(canUseDiscardImmediately(hand, c("K", "clubs"), [ownMeld])).toBe(true);
  });

  it("still rejects the pickup when the hand has nothing to bridge the gap", () => {
    const ownMeld: Meld = {
      id: "m1",
      type: "run",
      ownerId: "p1",
      cards: [c("9", "clubs"), c("10", "clubs"), c("J", "clubs")],
    };
    const hand = [c("2", "spades"), c("9", "hearts")];
    expect(canUseDiscardImmediately(hand, c("K", "clubs"), [ownMeld])).toBe(false);
  });

  // Generalizes to a bigger gap needing TWO hand cards alongside the
  // claimed one, all landing on the same existing meld together.
  it("allows the pickup when it needs two hand cards together with it to extend an own meld", () => {
    const ownMeld: Meld = {
      id: "m1",
      type: "run",
      ownerId: "p1",
      cards: [c("8", "diamonds"), c("9", "diamonds"), c("10", "diamonds")],
    };
    const hand = [c("J", "diamonds"), c("Q", "diamonds"), c("2", "spades")];
    expect(canUseDiscardImmediately(hand, c("K", "diamonds"), [ownMeld])).toBe(true);
  });
});

// Reported bug (R4, part 2): a card that only serves for DESMOCHE — not
// immediately usable in the hand alone — must still be claimable, not
// auto-rejected just because it doesn't serve "de inmediato" in the
// narrower canUseDiscardImmediately sense.
describe("canUseDiscardWithDesmoche / canClaimDiscard", () => {
  it("is false when the card genuinely doesn't help even combined with any legal desmoche", () => {
    const ownMeld: Meld = {
      id: "m1",
      type: "set",
      ownerId: "p1",
      cards: [c("8", "spades"), c("8", "hearts"), c("8", "clubs"), c("8", "diamonds")],
    };
    const hand = [c("2", "spades")];
    // A totally unrelated card — no desmoche of the 8s set helps a lone 2♠.
    expect(canUseDiscardWithDesmoche(hand, c("K", "clubs"), [ownMeld])).toBe(false);
    expect(canClaimDiscard(hand, c("K", "clubs"), [ownMeld])).toBe(false);
  });

  it("is true when desmocharring a card out of an own meld lets it combine with hand cards into a brand-new meld", () => {
    // 8♦ desmochado from this 4-card set of 8s (remainder 8♠-8♥-8♣ stays a
    // valid 3-card set), combined with a 7♦ already in hand, completes a
    // 6♦-7♦-8♦ run with the claimed 6♦ — but the claimed 6♦ does NOT work
    // on its own: it doesn't extend the set of 8s, and 7♦ alone in hand
    // can't form any new meld by itself.
    const ownMeld: Meld = {
      id: "m1",
      type: "set",
      ownerId: "p1",
      cards: [c("8", "spades"), c("8", "hearts"), c("8", "clubs"), c("8", "diamonds")],
    };
    const hand = [c("7", "diamonds")];

    expect(canUseDiscardImmediately(hand, c("6", "diamonds"), [ownMeld])).toBe(false);
    expect(canUseDiscardWithDesmoche(hand, c("6", "diamonds"), [ownMeld])).toBe(true);
    expect(canClaimDiscard(hand, c("6", "diamonds"), [ownMeld])).toBe(true);
  });

  it("canClaimDiscard is also true for the plain immediate case, without needing any desmoche", () => {
    const hand = [c("2", "spades")];
    expect(canClaimDiscard(hand, c("9", "diamonds"), [])).toBe(false);
    const ownMeld: Meld = {
      id: "m1",
      type: "run",
      ownerId: "p1",
      cards: [c("6", "hearts"), c("7", "hearts"), c("8", "hearts")],
    };
    expect(canClaimDiscard(hand, c("9", "hearts"), [ownMeld])).toBe(true);
  });

  // Corrected per direct user follow-up: "bajar de más" (extending a
  // placed meld) is never mandatory in advance — a player can hold back
  // part of a longer run/set as a surprise indefinitely, and play some of
  // it right as part of THIS move: extend a placed meld with hand cards
  // FIRST, then desmocha out of the result, all in one claim.
  describe("extending the source meld with hand cards first, then desmocharring", () => {
    it("accepts a claim that needs the source meld extended with a held-back card before it can be desmochado", () => {
      // Placed 6♦-7♦-8♦ (only 3 cards — NOT desmocharrable on its own).
      // Holding an 8♠ and, crucially, the 5♦ that would extend it to
      // 5♦-6♦-7♦-8♦ (still not placed — a "surprise"). Claiming an 8♣
      // only works by: extending with the 5♦, desmocharring the 8♦ out
      // of the resulting 4-card run, then using 8♦+8♠+8♣ as a new trio.
      const ownMeld: Meld = {
        id: "m1",
        type: "run",
        ownerId: "p1",
        cards: [c("6", "diamonds"), c("7", "diamonds"), c("8", "diamonds")],
      };
      const hand = [c("5", "diamonds"), c("8", "spades")];

      expect(canUseDiscardImmediately(hand, c("8", "clubs"), [ownMeld])).toBe(false);
      // The OLD (pre-correction) desmoche check would reject this too,
      // since the meld is only 3 cards as-is — canDesmocharFrom alone
      // (no extension) correctly says no:
      expect(canDesmocharFrom(ownMeld.cards, c("8", "diamonds"))).toBe(false);
      // But WITH the extension considered, the claim is valid:
      expect(canUseDiscardWithDesmoche(hand, c("8", "clubs"), [ownMeld])).toBe(true);
      expect(canClaimDiscard(hand, c("8", "clubs"), [ownMeld])).toBe(true);
    });

    it("still rejects when no hand card could extend the source meld into something desmochable", () => {
      const ownMeld: Meld = {
        id: "m1",
        type: "run",
        ownerId: "p1",
        cards: [c("6", "diamonds"), c("7", "diamonds"), c("8", "diamonds")],
      };
      // No 5♦ or 9♦ anywhere — nothing extends this run at all.
      const hand = [c("J", "spades"), c("2", "clubs")];
      expect(canUseDiscardWithDesmoche(hand, c("8", "clubs"), [ownMeld])).toBe(false);
      expect(canClaimDiscard(hand, c("8", "clubs"), [ownMeld])).toBe(false);
    });

    it("also works extending with TWO held-back cards at once", () => {
      // Placed 6♦-7♦ is only 2 cards (not even a meld on its own — this
      // simulates a meld that was already down at 3 and had one end
      // desmochado away previously, or just an edge case) — extend with
      // BOTH 5♦ and 8♦ (still in hand) to make 5♦-6♦-7♦-8♦, THEN desmocha
      // the 8♦ right back out for the new trio.
      const ownMeld: Meld = {
        id: "m1",
        type: "run",
        ownerId: "p1",
        cards: [c("6", "diamonds"), c("7", "diamonds")],
      };
      const hand = [c("5", "diamonds"), c("8", "diamonds"), c("8", "spades")];
      expect(canUseDiscardWithDesmoche(hand, c("8", "clubs"), [ownMeld])).toBe(true);
    });
  });
});

describe("canDesmocharAnyCardFromWithExtension", () => {
  it("is true for a meld too short to desmocha as-is, if a hand card would extend it first", () => {
    const meld = [c("6", "diamonds"), c("7", "diamonds"), c("8", "diamonds")];
    expect(canDesmocharAnyCardFrom(meld)).toBe(false); // not as-is
    expect(canDesmocharAnyCardFromWithExtension(meld, [c("5", "diamonds")])).toBe(true);
  });

  it("is false when nothing in hand would extend it", () => {
    const meld = [c("6", "diamonds"), c("7", "diamonds"), c("8", "diamonds")];
    expect(canDesmocharAnyCardFromWithExtension(meld, [c("J", "spades")])).toBe(false);
  });
});

describe("resolveDesmocheExtension", () => {
  it("resolves the extend-then-desmoche split for the reported scenario", () => {
    // selected = everything the player tapped for this move: the 5♦ that
    // extends the source meld, the 8♠ already in hand, and the claimed 8♣
    // itself (claimed cards land in hand and get tapped like any other) —
    // together with the desmochado 8♦, [8♦,8♠,8♣] must complete the trio.
    const sourceMeldCards = [c("6", "diamonds"), c("7", "diamonds"), c("8", "diamonds")];
    const selected = [c("5", "diamonds"), c("8", "spades"), c("8", "clubs")];
    const result = resolveDesmocheExtension(sourceMeldCards, c("8", "diamonds"), selected);
    expect(result).toEqual({
      extendWith: [c("5", "diamonds")],
      newMeldCards: [c("8", "spades"), c("8", "clubs")],
    });
  });

  it("prefers the no-extension solution when the meld is already desmochable as-is", () => {
    const sourceMeldCards = [c("5", "diamonds"), c("6", "diamonds"), c("7", "diamonds"), c("8", "diamonds")];
    const selected = [c("8", "spades"), c("8", "clubs")];
    const result = resolveDesmocheExtension(sourceMeldCards, c("8", "diamonds"), selected);
    expect(result).toEqual({ extendWith: [], newMeldCards: [c("8", "spades"), c("8", "clubs")] });
  });

  it("returns null when no split of the selected cards resolves anything", () => {
    const sourceMeldCards = [c("6", "diamonds"), c("7", "diamonds"), c("8", "diamonds")];
    const selected = [c("2", "clubs")];
    expect(resolveDesmocheExtension(sourceMeldCards, c("8", "diamonds"), selected)).toBeNull();
  });
});

describe("canDesmocharFrom", () => {
  it("rejects removing a card from a 3-card meld", () => {
    const meld = [c("8", "hearts"), c("8", "clubs"), c("8", "diamonds")];
    expect(canDesmocharFrom(meld, c("8", "hearts"))).toBe(false);
  });

  it("allows removing a card from a 4-card set — the remainder is still a valid 3-card set", () => {
    const meld = [
      c("8", "hearts"),
      c("8", "clubs"),
      c("8", "diamonds"),
      c("8", "spades"),
    ];
    expect(canDesmocharFrom(meld, c("8", "spades"))).toBe(true);
  });

  // Reported bug: a 5-card run 9-10-J-Q-K (spades) had its 10 desmochado,
  // leaving 9-J-Q-K on the table — 4 cards, so the old length-only check
  // allowed it, but 9-J-Q-K has a gap and is NOT a valid run. This must be
  // rejected; only removing an END card (9 or K) keeps a valid run.
  it("rejects desmocharring a card that would leave a gap in a run, even with 3+ cards remaining", () => {
    const run = [
      c("9", "spades"),
      c("10", "spades"),
      c("J", "spades"),
      c("Q", "spades"),
      c("K", "spades"),
    ];
    expect(canDesmocharFrom(run, c("10", "spades"))).toBe(false);
    expect(canDesmocharFrom(run, c("J", "spades"))).toBe(false);
    expect(canDesmocharFrom(run, c("Q", "spades"))).toBe(false);
  });

  it("allows desmocharring an END card of a run, since the remainder is still a valid, shorter run", () => {
    const run = [
      c("9", "spades"),
      c("10", "spades"),
      c("J", "spades"),
      c("Q", "spades"),
      c("K", "spades"),
    ];
    expect(canDesmocharFrom(run, c("9", "spades"))).toBe(true);
    expect(canDesmocharFrom(run, c("K", "spades"))).toBe(true);
  });
});

describe("canDesmocharAnyCardFrom", () => {
  it("is true for a 4-card run, since at least one end card can be safely removed", () => {
    const run = [c("9", "spades"), c("10", "spades"), c("J", "spades"), c("Q", "spades")];
    expect(canDesmocharAnyCardFrom(run)).toBe(true);
  });

  it("is false for an exact 3-card meld — nothing can be removed at all", () => {
    const set = [c("8", "hearts"), c("8", "clubs"), c("8", "diamonds")];
    expect(canDesmocharAnyCardFrom(set)).toBe(false);
  });
});

describe("isHandEmptied", () => {
  it("is true once nothing remains", () => {
    expect(isHandEmptied([])).toBe(true);
  });

  it("is false while cards remain", () => {
    expect(isHandEmptied([c("2", "spades")])).toBe(false);
  });
});

describe("findPlayableCardIds", () => {
  it("highlights a hand card that extends an own meld on its own", () => {
    const ownMeld: Meld = {
      id: "m1",
      type: "run",
      ownerId: "p1",
      cards: [c("5", "hearts"), c("6", "hearts"), c("7", "hearts")],
    };
    const hand = [c("8", "hearts"), c("2", "spades"), c("9", "clubs")];
    const playable = findPlayableCardIds(hand, [ownMeld], null);
    expect(playable.has(cardId(c("8", "hearts")))).toBe(true);
    expect(playable.has(cardId(c("2", "spades")))).toBe(false);
    expect(playable.has(cardId(c("9", "clubs")))).toBe(false);
  });

  it("highlights all 3 cards of a brand-new meld the hand can form on its own", () => {
    const hand = [c("8", "hearts"), c("8", "clubs"), c("8", "diamonds"), c("2", "spades")];
    const playable = findPlayableCardIds(hand, [], null);
    expect(playable.has(cardId(c("8", "hearts")))).toBe(true);
    expect(playable.has(cardId(c("8", "clubs")))).toBe(true);
    expect(playable.has(cardId(c("8", "diamonds")))).toBe(true);
    expect(playable.has(cardId(c("2", "spades")))).toBe(false);
  });

  it("finds nothing when no card fits anywhere", () => {
    const hand = [c("2", "spades"), c("9", "clubs"), c("K", "diamonds")];
    expect(findPlayableCardIds(hand, [], null).size).toBe(0);
  });

  it("with a required (pending) card, only highlights combos that include it — mirrors the server's own rule", () => {
    const hand = [c("8", "hearts"), c("8", "clubs"), c("8", "diamonds"), c("9", "clubs"), c("9", "hearts")];
    const required = c("8", "diamonds");
    const playable = findPlayableCardIds(hand, [], required);
    // The 9-9 pair alone (no third 9, and not involving the required 8♦) must NOT be highlighted.
    expect(playable.has(cardId(c("9", "clubs")))).toBe(false);
    expect(playable.has(cardId(c("9", "hearts")))).toBe(false);
    // The required card combined with the other two 8s forms a valid set.
    expect(playable.has(cardId(required))).toBe(true);
    expect(playable.has(cardId(c("8", "hearts")))).toBe(true);
    expect(playable.has(cardId(c("8", "clubs")))).toBe(true);
  });

  it("with a required card, also highlights it if it alone extends an own meld", () => {
    const ownMeld: Meld = {
      id: "m1",
      type: "set",
      ownerId: "p1",
      cards: [c("8", "hearts"), c("8", "clubs"), c("8", "diamonds")],
    };
    const required = c("8", "spades");
    const playable = findPlayableCardIds([required], [ownMeld], required);
    expect(playable.has(cardId(required))).toBe(true);
  });
});
