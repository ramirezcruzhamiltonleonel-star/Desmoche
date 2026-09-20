import { cardId, type Card } from "./cards";
import type { Meld } from "./melds";
import { canDesmocharFrom, canUseDiscardImmediately, findPlayableCardIds, isHandEmptied } from "./meldActions";

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
});

describe("canDesmocharFrom", () => {
  it("rejects removing a card from a 3-card meld", () => {
    const meld = [c("8", "hearts"), c("8", "clubs"), c("8", "diamonds")];
    expect(canDesmocharFrom(meld)).toBe(false);
  });

  it("allows removing a card from a 4-card meld", () => {
    const meld = [
      c("8", "hearts"),
      c("8", "clubs"),
      c("8", "diamonds"),
      c("8", "spades"),
    ];
    expect(canDesmocharFrom(meld)).toBe(true);
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
