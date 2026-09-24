import { countMicoAbajo, countMicoArriba, hasMicoAbajo, hasMicoArriba } from "./bonuses";
import type { Card } from "./cards";
import type { Meld } from "./melds";

function c(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

function meld(type: Meld["type"], cards: Card[]): Meld {
  return { id: "m1", type, ownerId: "p1", cards };
}

// Moved here from server/src/game/bonuses.ts so the client can also detect
// Mico for a first-time contextual explanation (winningMelds is already
// sent to the client) without duplicating the detection logic — server
// re-exports these same functions, still covered by its own test suite too.
describe("hasMicoAbajo", () => {
  it("is true for an A-2-3 run of the same suit", () => {
    expect(hasMicoAbajo([meld("run", [c("A", "clubs"), c("2", "clubs"), c("3", "clubs")])])).toBe(true);
  });

  it("is false for a Q-K-A run", () => {
    expect(hasMicoAbajo([meld("run", [c("Q", "clubs"), c("K", "clubs"), c("A", "clubs")])])).toBe(false);
  });

  it("is true for a longer run containing A-2-3", () => {
    const run = [c("A", "hearts"), c("2", "hearts"), c("3", "hearts"), c("4", "hearts")];
    expect(hasMicoAbajo([meld("run", run)])).toBe(true);
  });
});

describe("hasMicoArriba", () => {
  it("is true for a Q-K-A run of the same suit", () => {
    expect(hasMicoArriba([meld("run", [c("Q", "diamonds"), c("K", "diamonds"), c("A", "diamonds")])])).toBe(true);
  });

  it("is false for an A-2-3 run", () => {
    expect(hasMicoArriba([meld("run", [c("A", "diamonds"), c("2", "diamonds"), c("3", "diamonds")])])).toBe(false);
  });

  it("is true for a longer run containing Q-K-A", () => {
    const run = [c("J", "spades"), c("Q", "spades"), c("K", "spades"), c("A", "spades")];
    expect(hasMicoArriba([meld("run", run)])).toBe(true);
  });
});

// Reported bug: two Micos of the same type in different suits, in the same
// winning hand, must each count separately — not collapse into one.
describe("countMicoAbajo / countMicoArriba", () => {
  it("counts each qualifying Mico abajo run separately, even in different suits", () => {
    const melds = [
      meld("run", [c("A", "clubs"), c("2", "clubs"), c("3", "clubs")]),
      meld("run", [c("A", "hearts"), c("2", "hearts"), c("3", "hearts")]),
    ];
    expect(countMicoAbajo(melds)).toBe(2);
  });

  it("counts zero when nothing qualifies", () => {
    const melds = [meld("set", [c("8", "spades"), c("8", "hearts"), c("8", "clubs")])];
    expect(countMicoAbajo(melds)).toBe(0);
    expect(countMicoArriba(melds)).toBe(0);
  });
});
