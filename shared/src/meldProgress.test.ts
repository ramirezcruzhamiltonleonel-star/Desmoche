import { computeMeldProgress } from "./meldProgress";
import type { Card } from "./cards";
import type { Meld } from "./melds";

function c(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

describe("computeMeldProgress", () => {
  it("is 0 with nothing melded yet", () => {
    const hand = [c("2", "spades"), c("3", "hearts"), c("4", "clubs")];
    const progress = computeMeldProgress(hand, []);
    expect(progress).toEqual({ meldedCount: 0, totalCount: 3, fraction: 0 });
  });

  it("counts cards across every own meld already on the table", () => {
    const hand = [c("2", "spades"), c("3", "hearts")];
    const melds: Meld[] = [
      { id: "m1", type: "set", ownerId: "p1", cards: [c("8", "spades"), c("8", "hearts"), c("8", "clubs")] },
      { id: "m2", type: "run", ownerId: "p1", cards: [c("4", "diamonds"), c("5", "diamonds"), c("6", "diamonds")] },
    ];
    const progress = computeMeldProgress(hand, melds);
    // 2 in hand + 6 melded = 8 total; 6/8 melded.
    expect(progress.meldedCount).toBe(6);
    expect(progress.totalCount).toBe(8);
    expect(progress.fraction).toBeCloseTo(0.75);
  });

  it("is 1 (fully melded) the instant nothing remains in hand — the actual win condition", () => {
    const melds: Meld[] = [
      { id: "m1", type: "set", ownerId: "p1", cards: [c("8", "spades"), c("8", "hearts"), c("8", "clubs")] },
    ];
    const progress = computeMeldProgress([], melds);
    expect(progress.fraction).toBe(1);
  });

  it("never divides by zero when both hand and melds are empty", () => {
    expect(computeMeldProgress([], []).fraction).toBe(0);
  });
});
