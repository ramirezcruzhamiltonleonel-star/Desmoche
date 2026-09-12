import { firstTurnStockDrawCount } from "./firstTurn";

describe("firstTurnStockDrawCount", () => {
  it("draws 2 cards when nobody claimed the initial discard", () => {
    expect(firstTurnStockDrawCount(false)).toBe(2);
  });

  it("draws the normal 1 card when the initial discard was claimed", () => {
    expect(firstTurnStockDrawCount(true)).toBe(1);
  });
});
