import { combinations } from "./combinations";

describe("combinations", () => {
  it("returns all k-sized subsets", () => {
    expect(combinations([1, 2, 3], 2)).toEqual([
      [1, 2],
      [1, 3],
      [2, 3],
    ]);
  });

  it("returns a single empty combination for k=0", () => {
    expect(combinations([1, 2, 3], 0)).toEqual([[]]);
  });

  it("returns nothing when k exceeds the input size", () => {
    expect(combinations([1, 2], 3)).toEqual([]);
  });

  it("returns the full set once when k equals input length", () => {
    expect(combinations(["a", "b"], 2)).toEqual([["a", "b"]]);
  });
});
