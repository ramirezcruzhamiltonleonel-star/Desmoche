import { meldLabel } from "./meldLabel";
import type { Card } from "./cards";
import type { Meld } from "./melds";

function c(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

function meld(type: "set" | "run", cards: Card[]): Meld {
  return { id: "m1", type, ownerId: "p1", cards };
}

describe("meldLabel", () => {
  it("labels a set by its shared rank — always unique across the whole game", () => {
    const set = meld("set", [c("8", "spades"), c("8", "hearts"), c("8", "clubs")]);
    expect(meldLabel(set)).toBe("Tercia de 8 (3)");
  });

  it("labels an Ace-low run (Mico abajo) with Ace first", () => {
    const run = meld("run", [c("3", "clubs"), c("A", "clubs"), c("2", "clubs")]);
    expect(meldLabel(run)).toBe("Escalera ♣ A-3 (3)");
  });

  it("labels an Ace-high run (Mico arriba) with Ace last, not first", () => {
    const run = meld("run", [c("K", "diamonds"), c("A", "diamonds"), c("Q", "diamonds")]);
    expect(meldLabel(run)).toBe("Escalera ♦ Q-A (3)");
  });

  it("gives two different-suit runs of the same length genuinely different labels", () => {
    const heartsRun = meld("run", [c("5", "hearts"), c("6", "hearts"), c("7", "hearts")]);
    const spadesRun = meld("run", [c("5", "spades"), c("6", "spades"), c("7", "spades")]);
    expect(meldLabel(heartsRun)).not.toBe(meldLabel(spadesRun));
  });

  it("gives two same-suit runs of different span genuinely different labels — the actual reported ambiguity", () => {
    const lowRun = meld("run", [c("3", "hearts"), c("4", "hearts"), c("5", "hearts")]);
    const highRun = meld("run", [c("8", "hearts"), c("9", "hearts"), c("10", "hearts")]);
    // Old label for both: "Escalera (3)" — genuinely indistinguishable.
    expect(meldLabel(lowRun)).toBe("Escalera ♥ 3-5 (3)");
    expect(meldLabel(highRun)).toBe("Escalera ♥ 8-10 (3)");
  });
});
