import {
  resolveDiscardClaimPriority,
  seatToPlayAfterClaimedTurn,
  seatToPlayAfterDiscard,
} from "./discardClaim";

describe("resolveDiscardClaimPriority", () => {
  it("gives priority to the claimant closest to the discarder", () => {
    // discarder at seat 0, claimants at 2 and 3 -> 2 is closer
    expect(resolveDiscardClaimPriority(0, [2, 3], 4)).toBe(2);
  });
});

describe("seatToPlayAfterDiscard", () => {
  it("moves to the normal next seat when nobody claimed", () => {
    expect(seatToPlayAfterDiscard(0, null, 4)).toBe(1);
  });

  it("jumps straight to the claim winner when someone claimed", () => {
    expect(seatToPlayAfterDiscard(0, 3, 4)).toBe(3);
  });
});

describe("seatToPlayAfterClaimedTurn", () => {
  it("resumes normal rotation from the seat after the claimant", () => {
    expect(seatToPlayAfterClaimedTurn(3, 4)).toBe(0);
  });
});
