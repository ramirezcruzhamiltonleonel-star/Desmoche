import { hasCorazon, hasFlor, hasOro } from "./sidebets";
import type { Card } from "./cards";
import type { Meld } from "./melds";

function c(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

function meld(type: Meld["type"], cards: Card[]): Meld {
  return { id: "m1", type, ownerId: "p1", cards };
}

describe("hasOro", () => {
  it("is true when every winning meld is an escalera of diamonds", () => {
    const melds = [
      meld("run", [c("2", "diamonds"), c("3", "diamonds"), c("4", "diamonds")]),
      meld("run", [c("7", "diamonds"), c("8", "diamonds"), c("9", "diamonds")]),
    ];
    expect(hasOro(melds)).toBe(true);
  });

  it("is false if even one winning meld is a different suit", () => {
    const melds = [
      meld("run", [c("2", "diamonds"), c("3", "diamonds"), c("4", "diamonds")]),
      meld("run", [c("7", "hearts"), c("8", "hearts"), c("9", "hearts")]),
    ];
    expect(hasOro(melds)).toBe(false);
  });

  // A tercia requires 3 DIFFERENT suits by rule, so it can never itself be
  // single-suit — any tercia in the winning play disqualifies Oro/Corazón/
  // Flor outright, exactly like a wrong-suit escalera would.
  it("is false if the winning play includes ANY tercia, even an all-diamond-looking one is impossible by rule but a mixed one still disqualifies", () => {
    const melds = [
      meld("run", [c("2", "diamonds"), c("3", "diamonds"), c("4", "diamonds")]),
      meld("set", [c("8", "diamonds"), c("8", "hearts"), c("8", "clubs")]),
    ];
    expect(hasOro(melds)).toBe(false);
  });

  it("is false for an empty winning-melds list (auto-wins)", () => {
    expect(hasOro([])).toBe(false);
  });
});

describe("hasCorazon", () => {
  it("is true when every winning meld is an escalera of hearts", () => {
    const melds = [meld("run", [c("5", "hearts"), c("6", "hearts"), c("7", "hearts")])];
    expect(hasCorazon(melds)).toBe(true);
  });

  it("is false for diamonds", () => {
    const melds = [meld("run", [c("5", "diamonds"), c("6", "diamonds"), c("7", "diamonds")])];
    expect(hasCorazon(melds)).toBe(false);
  });
});

describe("hasFlor", () => {
  it("is true for an all-same-suit close in spades or clubs too, not just diamonds/hearts", () => {
    const melds = [
      meld("run", [c("2", "spades"), c("3", "spades"), c("4", "spades")]),
      meld("run", [c("7", "spades"), c("8", "spades"), c("9", "spades")]),
    ];
    expect(hasFlor(melds)).toBe(true);
  });

  it("is also true for an all-diamonds close (Oro is a special case of Flor)", () => {
    const melds = [meld("run", [c("2", "diamonds"), c("3", "diamonds"), c("4", "diamonds")])];
    expect(hasFlor(melds)).toBe(true);
  });

  it("is false when the winning melds mix two different suits", () => {
    const melds = [
      meld("run", [c("2", "spades"), c("3", "spades"), c("4", "spades")]),
      meld("run", [c("7", "clubs"), c("8", "clubs"), c("9", "clubs")]),
    ];
    expect(hasFlor(melds)).toBe(false);
  });

  it("is false when any winning meld is a tercia", () => {
    const melds = [
      meld("run", [c("2", "spades"), c("3", "spades"), c("4", "spades")]),
      meld("set", [c("9", "spades"), c("9", "hearts"), c("9", "clubs")]),
    ];
    expect(hasFlor(melds)).toBe(false);
  });
});
