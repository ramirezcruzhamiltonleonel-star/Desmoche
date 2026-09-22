import { explainClaimUsefulness } from "./claimHint";
import type { Card } from "./cards";
import type { Meld } from "./melds";

function c(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

describe("explainClaimUsefulness", () => {
  it("explains a direct extend onto an own meld", () => {
    const ownMeld: Meld = {
      id: "m1",
      type: "run",
      ownerId: "p1",
      cards: [c("5", "hearts"), c("6", "hearts"), c("7", "hearts")],
    };
    const text = explainClaimUsefulness([c("2", "spades")], c("8", "hearts"), [ownMeld]);
    expect(text).toContain("8♥");
    expect(text).toContain("Sí me sirve");
  });

  it("explains completing a new set from the hand", () => {
    const hand = [c("8", "hearts"), c("8", "clubs"), c("2", "spades")];
    const text = explainClaimUsefulness(hand, c("8", "diamonds"), []);
    expect(text).toContain("tercia");
    expect(text).toContain("8");
  });

  it("explains completing a new run from the hand", () => {
    const hand = [c("5", "hearts"), c("6", "hearts"), c("2", "spades")];
    const text = explainClaimUsefulness(hand, c("7", "hearts"), []);
    expect(text).toContain("escalera");
  });

  it("returns null when the card genuinely doesn't serve (nothing to explain)", () => {
    const hand = [c("2", "spades"), c("9", "clubs"), c("K", "diamonds")];
    expect(explainClaimUsefulness(hand, c("4", "hearts"), [])).toBeNull();
  });
});
