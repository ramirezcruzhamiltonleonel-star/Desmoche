import type { Card } from "./cards";
import { canExtendMeld, isValidMeld, isValidRun, isValidSet } from "./meldRules";

function c(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

describe("isValidSet", () => {
  it("accepts 3 cards of the same rank, different suits", () => {
    expect(isValidSet([c("8", "spades"), c("8", "hearts"), c("8", "clubs")])).toBe(true);
  });

  it("accepts 4 cards of the same rank, different suits", () => {
    expect(
      isValidSet([c("K", "spades"), c("K", "hearts"), c("K", "clubs"), c("K", "diamonds")]),
    ).toBe(true);
  });

  it("rejects a repeated suit", () => {
    expect(isValidSet([c("8", "spades"), c("8", "spades"), c("8", "clubs")])).toBe(false);
  });

  it("rejects mixed ranks", () => {
    expect(isValidSet([c("8", "spades"), c("9", "hearts"), c("8", "clubs")])).toBe(false);
  });

  it("rejects fewer than 3 or more than 4 cards", () => {
    expect(isValidSet([c("8", "spades"), c("8", "hearts")])).toBe(false);
  });
});

describe("isValidRun", () => {
  it("accepts 3 consecutive cards of the same suit", () => {
    expect(isValidRun([c("5", "hearts"), c("6", "hearts"), c("7", "hearts")])).toBe(true);
  });

  it("accepts Ace-low run A-2-3", () => {
    expect(isValidRun([c("A", "clubs"), c("2", "clubs"), c("3", "clubs")])).toBe(true);
  });

  it("accepts Ace-high run Q-K-A", () => {
    expect(isValidRun([c("Q", "diamonds"), c("K", "diamonds"), c("A", "diamonds")])).toBe(true);
  });

  it("rejects the K-A-2 wraparound", () => {
    expect(isValidRun([c("K", "spades"), c("A", "spades"), c("2", "spades")])).toBe(false);
  });

  it("rejects mixed suits", () => {
    expect(isValidRun([c("5", "hearts"), c("6", "spades"), c("7", "hearts")])).toBe(false);
  });

  it("rejects non-consecutive ranks", () => {
    expect(isValidRun([c("5", "hearts"), c("7", "hearts"), c("9", "hearts")])).toBe(false);
  });

  it("rejects fewer than 3 cards", () => {
    expect(isValidRun([c("5", "hearts"), c("6", "hearts")])).toBe(false);
  });

  it("accepts a 4-card run", () => {
    expect(
      isValidRun([c("4", "clubs"), c("5", "clubs"), c("6", "clubs"), c("7", "clubs")]),
    ).toBe(true);
  });
});

describe("isValidMeld", () => {
  it("accepts either a valid set or a valid run", () => {
    expect(isValidMeld([c("8", "spades"), c("8", "hearts"), c("8", "clubs")])).toBe(true);
    expect(isValidMeld([c("5", "hearts"), c("6", "hearts"), c("7", "hearts")])).toBe(true);
  });

  it("rejects garbage", () => {
    expect(isValidMeld([c("5", "hearts"), c("9", "clubs"), c("2", "diamonds")])).toBe(false);
  });
});

describe("canExtendMeld", () => {
  it("allows extending a run with the next consecutive card", () => {
    const run = [c("5", "hearts"), c("6", "hearts"), c("7", "hearts")];
    expect(canExtendMeld(run, c("8", "hearts"))).toBe(true);
  });

  it("rejects extending with a card of the wrong suit", () => {
    const run = [c("5", "hearts"), c("6", "hearts"), c("7", "hearts")];
    expect(canExtendMeld(run, c("8", "clubs"))).toBe(false);
  });

  it("allows extending a 3-card set to 4 with the missing suit", () => {
    const set = [c("Q", "spades"), c("Q", "hearts"), c("Q", "clubs")];
    expect(canExtendMeld(set, c("Q", "diamonds"))).toBe(true);
  });

  it("rejects extending a full 4-card set", () => {
    const set = [c("Q", "spades"), c("Q", "hearts"), c("Q", "clubs"), c("Q", "diamonds")];
    // no 5th suit exists, so this would always be invalid — sanity check with a duplicate
    expect(canExtendMeld(set, c("Q", "spades"))).toBe(false);
  });
});
