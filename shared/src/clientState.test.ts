import { isAutoWinReason, type HandOutcomeReason } from "./clientState";

describe("isAutoWinReason", () => {
  it("is true for Peladía", () => {
    expect(isAutoWinReason("peladia")).toBe(true);
  });

  it("is true for Cuatro Cuerpos", () => {
    expect(isAutoWinReason("cuatro-cuerpos")).toBe(true);
  });

  it("is false for every other hand-ending reason", () => {
    const others: HandOutcomeReason[] = ["meld-out", "discard-out", "stock-exhausted"];
    for (const reason of others) {
      expect(isAutoWinReason(reason)).toBe(false);
    }
  });
});
