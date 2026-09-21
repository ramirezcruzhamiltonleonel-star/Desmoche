import { hasMicoAbajo, hasMicoArriba } from "./bonuses";
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
});

describe("hasMicoArriba", () => {
  it("is true for a Q-K-A run of the same suit", () => {
    expect(hasMicoArriba([meld("run", [c("Q", "diamonds"), c("K", "diamonds"), c("A", "diamonds")])])).toBe(true);
  });

  it("is false for an A-2-3 run", () => {
    expect(hasMicoArriba([meld("run", [c("A", "diamonds"), c("2", "diamonds"), c("3", "diamonds")])])).toBe(false);
  });
});
