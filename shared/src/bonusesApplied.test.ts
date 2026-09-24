import { bonusesAppliedThisHand } from "./bonusesApplied";
import type { Card } from "./cards";
import type { ClientHandOutcome, ClientHandSettlement } from "./clientState";
import type { Meld } from "./melds";

function c(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

function outcome(reason: ClientHandOutcome["reason"], winningMelds: Meld[] = []): ClientHandOutcome {
  return { reason, winnerSeatIndex: 0, winningMelds };
}

describe("bonusesAppliedThisHand", () => {
  it("is just peladia for a Peladía win", () => {
    expect(bonusesAppliedThisHand(outcome("peladia"), null)).toEqual(["peladia"]);
  });

  it("is just cuatro-cuerpos for a Cuatro Cuerpos win", () => {
    expect(bonusesAppliedThisHand(outcome("cuatro-cuerpos"), null)).toEqual(["cuatro-cuerpos"]);
  });

  it("detects mico from the winning melds on a normal meld-out win", () => {
    // A second, different-suit filler meld keeps this from also qualifying
    // for Corazón/Flor (same-suit-only close) — that combined detection is
    // covered on its own below.
    const melds: Meld[] = [
      { id: "m1", type: "run", ownerId: "p1", cards: [c("A", "hearts"), c("2", "hearts"), c("3", "hearts")] },
      { id: "m2", type: "run", ownerId: "p1", cards: [c("7", "clubs"), c("8", "clubs"), c("9", "clubs")] },
    ];
    expect(bonusesAppliedThisHand(outcome("meld-out", melds), null)).toEqual(["mico"]);
  });

  it("detects Oro/Corazón/Flor together when a Mico run happens to be the entire (single-suit) winning play", () => {
    const heartsOnly: Meld[] = [
      { id: "m1", type: "run", ownerId: "p1", cards: [c("A", "hearts"), c("2", "hearts"), c("3", "hearts")] },
    ];
    expect(bonusesAppliedThisHand(outcome("meld-out", heartsOnly), null)).toEqual(["mico", "corazon", "flor"]);

    const spadesOnly: Meld[] = [
      { id: "m1", type: "run", ownerId: "p1", cards: [c("Q", "spades"), c("K", "spades"), c("A", "spades")] },
    ];
    expect(bonusesAppliedThisHand(outcome("meld-out", spadesOnly), null)).toEqual(["mico", "flor"]);
  });

  it("detects patona from the settlement when a loser placed nothing all hand", () => {
    const settlement: ClientHandSettlement = {
      kind: "chips",
      winnerId: "p1",
      potWon: 300,
      extraPerLoser: { p2: 100 },
      patonaLoserIds: ["p2"],
    };
    expect(bonusesAppliedThisHand(outcome("meld-out"), settlement)).toEqual(["patona"]);
  });

  it("can detect mico AND patona together on the same hand", () => {
    const melds: Meld[] = [
      { id: "m1", type: "run", ownerId: "p1", cards: [c("Q", "spades"), c("K", "spades"), c("A", "spades")] },
      { id: "m2", type: "run", ownerId: "p1", cards: [c("7", "diamonds"), c("8", "diamonds"), c("9", "diamonds")] },
    ];
    const settlement: ClientHandSettlement = {
      kind: "chips",
      winnerId: "p1",
      potWon: 300,
      extraPerLoser: { p2: 200 },
      patonaLoserIds: ["p2"],
    };
    expect(bonusesAppliedThisHand(outcome("meld-out", melds), settlement)).toEqual(["mico", "patona"]);
  });

  it("is empty for a plain win with no bonuses at all", () => {
    const settlement: ClientHandSettlement = {
      kind: "chips",
      winnerId: "p1",
      potWon: 200,
      extraPerLoser: { p2: 0 },
      patonaLoserIds: [],
    };
    expect(bonusesAppliedThisHand(outcome("meld-out"), settlement)).toEqual([]);
  });

  it("is empty for a no-winner (stock-exhausted) hand", () => {
    expect(bonusesAppliedThisHand({ reason: "stock-exhausted", winnerSeatIndex: null, winningMelds: [] }, null)).toEqual(
      [],
    );
  });
});
