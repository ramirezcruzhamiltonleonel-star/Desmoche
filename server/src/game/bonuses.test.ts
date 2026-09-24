import type { Card, Meld } from "@desmoche/shared";
import { calculateBonuses, hasMicoAbajo, hasMicoArriba } from "./bonuses";

function c(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

function meld(type: Meld["type"], cards: Card[]): Meld {
  return { id: "m1", type, ownerId: "p1", cards };
}

describe("hasMicoAbajo", () => {
  it("is true for an A-2-3 run of the same suit", () => {
    const melds = [meld("run", [c("A", "clubs"), c("2", "clubs"), c("3", "clubs")])];
    expect(hasMicoAbajo(melds)).toBe(true);
  });

  it("is false for a Q-K-A run", () => {
    const melds = [meld("run", [c("Q", "clubs"), c("K", "clubs"), c("A", "clubs")])];
    expect(hasMicoAbajo(melds)).toBe(false);
  });

  it("is false for an unrelated set", () => {
    const melds = [meld("set", [c("8", "spades"), c("8", "hearts"), c("8", "clubs")])];
    expect(hasMicoAbajo(melds)).toBe(false);
  });

  // Reported bug: a longer run containing the A-2-3 sequence (not just the
  // exact 3-card run) must still pay Mico.
  it("is true for a longer run containing A-2-3, e.g. A-2-3-4", () => {
    const melds = [meld("run", [c("A", "hearts"), c("2", "hearts"), c("3", "hearts"), c("4", "hearts")])];
    expect(hasMicoAbajo(melds)).toBe(true);
  });
});

describe("hasMicoArriba", () => {
  it("is true for a Q-K-A run of the same suit", () => {
    const melds = [meld("run", [c("Q", "diamonds"), c("K", "diamonds"), c("A", "diamonds")])];
    expect(hasMicoArriba(melds)).toBe(true);
  });

  it("is false for an A-2-3 run", () => {
    const melds = [meld("run", [c("A", "diamonds"), c("2", "diamonds"), c("3", "diamonds")])];
    expect(hasMicoArriba(melds)).toBe(false);
  });

  // Reported bug: a longer run containing the Q-K-A sequence must still pay
  // Mico — e.g. J-Q-K-A contains Q-K-A.
  it("is true for a longer run containing Q-K-A, e.g. J-Q-K-A", () => {
    const melds = [
      meld("run", [c("J", "spades"), c("Q", "spades"), c("K", "spades"), c("A", "spades")]),
    ];
    expect(hasMicoArriba(melds)).toBe(true);
  });
});

describe("calculateBonuses", () => {
  it("charges one ante per bonus present", () => {
    const onlyAbajo = [meld("run", [c("A", "clubs"), c("2", "clubs"), c("3", "clubs")])];
    expect(calculateBonuses(onlyAbajo, 100).extraPerLoser).toBe(100);

    const both = [
      meld("run", [c("A", "clubs"), c("2", "clubs"), c("3", "clubs")]),
      meld("run", [c("Q", "diamonds"), c("K", "diamonds"), c("A", "diamonds")]),
    ];
    expect(calculateBonuses(both, 100).extraPerLoser).toBe(200);
  });

  it("charges nothing when there is no bonus", () => {
    const none = [meld("set", [c("8", "spades"), c("8", "hearts"), c("8", "clubs")])];
    const result = calculateBonuses(none, 100);
    expect(result.extraPerLoser).toBe(0);
    expect(result.micoAbajo).toBe(false);
    expect(result.micoArriba).toBe(false);
  });

  // Reported bug: two Micos of the SAME type in different suits in the same
  // winning hand must pay DOUBLE, not once.
  it("charges double when the same winning hand has two Mico abajo runs in different suits", () => {
    const twoAbajo = [
      meld("run", [c("A", "clubs"), c("2", "clubs"), c("3", "clubs")]),
      meld("run", [c("A", "hearts"), c("2", "hearts"), c("3", "hearts")]),
    ];
    const result = calculateBonuses(twoAbajo, 100);
    expect(result.extraPerLoser).toBe(200);
    expect(result.micoAbajo).toBe(true);
  });

  it("charges triple when a hand somehow has one Mico arriba and two Mico abajo runs (independent extras, one per qualifying run)", () => {
    const melds = [
      meld("run", [c("Q", "diamonds"), c("K", "diamonds"), c("A", "diamonds")]),
      meld("run", [c("A", "clubs"), c("2", "clubs"), c("3", "clubs")]),
      meld("run", [c("A", "hearts"), c("2", "hearts"), c("3", "hearts")]),
    ];
    expect(calculateBonuses(melds, 100).extraPerLoser).toBe(300);
  });
});
