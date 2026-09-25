import { affordabilityCheckApplies } from "./balance";

describe("affordabilityCheckApplies", () => {
  it("applies to a registered human at a chips table with a positive ante", () => {
    expect(affordabilityCheckApplies("user-1", "chips", 100)).toBe(true);
  });

  it("does not apply to a guest — no persistent balance to check yet", () => {
    expect(affordabilityCheckApplies("guest:abc", "chips", 100)).toBe(false);
  });

  it("does not apply to a bot — always topped up", () => {
    expect(affordabilityCheckApplies("bot:chepe", "chips", 100)).toBe(false);
  });

  it("does not apply in dare mode — no ante at all", () => {
    expect(affordabilityCheckApplies("user-1", "dare", 0)).toBe(false);
  });

  it("does not apply in money mode — schema-only for now", () => {
    expect(affordabilityCheckApplies("user-1", "money", 100)).toBe(false);
  });

  it("does not apply when the ante is 0", () => {
    expect(affordabilityCheckApplies("user-1", "chips", 0)).toBe(false);
  });
});
