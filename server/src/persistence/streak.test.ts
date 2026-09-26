import { updateStreakForPlay } from "./streak";

describe("updateStreakForPlay", () => {
  it("starts a fresh streak at 1 for a user who's never played before", () => {
    const result = updateStreakForPlay(
      { currentStreak: 0, longestStreak: 0, lastPlayedDate: null },
      new Date("2026-09-22T10:00:00Z"), // 4am Managua, Sept 22
    );
    expect(result).toEqual({
      currentStreak: 1,
      longestStreak: 1,
      lastPlayedDate: new Date("2026-09-22T00:00:00Z"),
    });
  });

  it("doesn't change anything for a second hand the same Managua day, even across a UTC midnight", () => {
    const state = { currentStreak: 3, longestStreak: 5, lastPlayedDate: new Date("2026-09-22T00:00:00Z") };
    // 10pm Managua on Sept 22 is 4am UTC on Sept 23 — still the same
    // Managua calendar day as the stored bucket. The old UTC-only logic
    // would have wrongly counted this as a new day.
    const result = updateStreakForPlay(state, new Date("2026-09-23T04:00:00Z"));
    expect(result).toEqual(state);
  });

  it("continues the streak by 1 when played exactly the next Managua day", () => {
    const state = { currentStreak: 3, longestStreak: 5, lastPlayedDate: new Date("2026-09-22T00:00:00Z") };
    // 7am Managua on Sept 23 — genuinely the next Managua calendar day.
    const result = updateStreakForPlay(state, new Date("2026-09-23T13:00:00Z"));
    expect(result).toEqual({
      currentStreak: 4,
      longestStreak: 5,
      lastPlayedDate: new Date("2026-09-23T00:00:00Z"),
    });
  });

  it("resets to 1 after a gap of more than one Managua day", () => {
    const state = { currentStreak: 7, longestStreak: 7, lastPlayedDate: new Date("2026-09-20T00:00:00Z") };
    const result = updateStreakForPlay(state, new Date("2026-09-23T13:00:00Z"));
    expect(result).toEqual({
      currentStreak: 1,
      longestStreak: 7,
      lastPlayedDate: new Date("2026-09-23T00:00:00Z"),
    });
  });

  it("raises longestStreak once a new streak surpasses the old record", () => {
    const state = { currentStreak: 6, longestStreak: 6, lastPlayedDate: new Date("2026-09-22T00:00:00Z") };
    const result = updateStreakForPlay(state, new Date("2026-09-23T13:00:00Z"));
    expect(result.currentStreak).toBe(7);
    expect(result.longestStreak).toBe(7);
  });
});
