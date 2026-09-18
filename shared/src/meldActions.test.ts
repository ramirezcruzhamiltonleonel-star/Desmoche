import type { Card } from "./cards";
import type { Meld } from "./melds";
import { canDesmocharFrom, canUseDiscardImmediately, isHandEmptied } from "./meldActions";

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
