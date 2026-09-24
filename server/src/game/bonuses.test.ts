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
    // A second, different-suit filler meld keeps this fixture from ALSO
    // accidentally qualifying for Flor (same-suit-only close) — that
    // interaction is covered on its own in the side-bets describe block
    // below, kept separate here so this stays a pure Mico-only assertion.
    const onlyAbajo = [
      meld("run", [c("A", "clubs"), c("2", "clubs"), c("3", "clubs")]),
      meld("run", [c("7", "hearts"), c("8", "hearts"), c("9", "hearts")]),
    ];
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

describe("calculateBonuses — side bets de casa (Oro, Corazón, Flor)", () => {
  it("pays Oro (2x ante) for closing with only diamond escaleras", () => {
    const melds = [
      meld("run", [c("2", "diamonds"), c("3", "diamonds"), c("4", "diamonds")]),
      meld("run", [c("7", "diamonds"), c("8", "diamonds"), c("9", "diamonds")]),
    ];
    const result = calculateBonuses(melds, 100);
    expect(result.oro).toBe(true);
    // Oro is itself a special case of Flor (same suit, specifically
    // diamonds) — both fire together, per the confirmed "independent
    // bonuses that stack" design.
    expect(result.flor).toBe(true);
    expect(result.extraPerLoser).toBe(100 * 2 + Math.round(100 * 1.5)); // 350
  });

  it("pays Corazón (2x ante) for closing with only heart escaleras", () => {
    const melds = [meld("run", [c("5", "hearts"), c("6", "hearts"), c("7", "hearts")])];
    const result = calculateBonuses(melds, 100);
    expect(result.corazon).toBe(true);
    expect(result.flor).toBe(true);
    expect(result.extraPerLoser).toBe(100 * 2 + Math.round(100 * 1.5)); // 350
  });

  it("pays Flor alone (1.5x ante) for a same-suit close in spades or clubs — no Oro/Corazón", () => {
    const melds = [meld("run", [c("2", "clubs"), c("3", "clubs"), c("4", "clubs")])];
    const result = calculateBonuses(melds, 100);
    expect(result.oro).toBe(false);
    expect(result.corazon).toBe(false);
    expect(result.flor).toBe(true);
    expect(result.extraPerLoser).toBe(Math.round(100 * 1.5)); // 150
  });

  it("stacks Flor with Mico when the same single run qualifies for both", () => {
    // A-2-3 of clubs is simultaneously a Mico abajo AND (being the whole
    // winning play, one suit) a Flor.
    const melds = [meld("run", [c("A", "clubs"), c("2", "clubs"), c("3", "clubs")])];
    const result = calculateBonuses(melds, 100);
    expect(result.micoAbajo).toBe(true);
    expect(result.flor).toBe(true);
    expect(result.extraPerLoser).toBe(100 + Math.round(100 * 1.5)); // 250
  });

  it("pays nothing extra when the winning play mixes suits or includes a tercia", () => {
    const mixedSuits = [
      meld("run", [c("2", "clubs"), c("3", "clubs"), c("4", "clubs")]),
      meld("run", [c("7", "hearts"), c("8", "hearts"), c("9", "hearts")]),
    ];
    expect(calculateBonuses(mixedSuits, 100).extraPerLoser).toBe(0);

    const withTercia = [
      meld("run", [c("2", "clubs"), c("3", "clubs"), c("4", "clubs")]),
      meld("set", [c("9", "clubs"), c("9", "hearts"), c("9", "diamonds")]),
    ];
    const result = calculateBonuses(withTercia, 100);
    expect(result.oro).toBe(false);
    expect(result.corazon).toBe(false);
    expect(result.flor).toBe(false);
    expect(result.extraPerLoser).toBe(0);
  });
});
