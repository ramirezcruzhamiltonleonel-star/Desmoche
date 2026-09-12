import { closestInRotation, nextSeat } from "./turnOrder";

describe("nextSeat", () => {
  it("advances by one", () => {
    expect(nextSeat(0, 4)).toBe(1);
  });

  it("wraps around to seat 0", () => {
    expect(nextSeat(3, 4)).toBe(0);
  });
});

describe("closestInRotation", () => {
  it("picks the candidate reached soonest going forward", () => {
    expect(closestInRotation(0, [1, 3], 4)).toBe(1);
  });

  it("wraps around the table when needed", () => {
    // from seat 3, stepping forward wraps to seat 0 first
    expect(closestInRotation(3, [0, 1], 4)).toBe(0);
  });

  it("works with a single candidate", () => {
    expect(closestInRotation(1, [2], 3)).toBe(2);
  });

  it("throws when there are no candidates", () => {
    expect(() => closestInRotation(0, [], 4)).toThrow();
  });
});
