import { updateStreakForPlay } from "./streak";

describe("updateStreakForPlay", () => {
  it("starts a fresh streak at 1 for a user who's never played before", () => {
    const result = updateStreakForPlay(
      { currentStreak: 0, longestStreak: 0, lastPlayedDate: null },
      new Date("2026-09-22T10:00:00Z"),
    );
    expect(result).toEqual({
      currentStreak: 1,
      longestStreak: 1,
      lastPlayedDate: new Date("2026-09-22T00:00:00Z"),
    });
  });

  it("doesn't change anything for a second hand the same UTC day", () => {
    const state = { currentStreak: 3, longestStreak: 5, lastPlayedDate: new Date("2026-09-22T00:00:00Z") };
    const result = updateStreakForPlay(state, new Date("2026-09-22T23:59:00Z"));
    expect(result).toEqual(state);
  });

  it("continues the streak by 1 when played exactly the next UTC day", () => {
    const state = { currentStreak: 3, longestStreak: 5, lastPlayedDate: new Date("2026-09-22T08:00:00Z") };
    const result = updateStreakForPlay(state, new Date("2026-09-23T02:00:00Z"));
    expect(result).toEqual({
      currentStreak: 4,
      longestStreak: 5,
      lastPlayedDate: new Date("2026-09-23T00:00:00Z"),
    });
  });

  it("resets to 1 after a gap of more than one day", () => {
    const state = { currentStreak: 7, longestStreak: 7, lastPlayedDate: new Date("2026-09-20T08:00:00Z") };
    const result = updateStreakForPlay(state, new Date("2026-09-23T02:00:00Z"));
    expect(result).toEqual({
      currentStreak: 1,
      longestStreak: 7,
      lastPlayedDate: new Date("2026-09-23T00:00:00Z"),
    });
  });

  it("raises longestStreak once a new streak surpasses the old record", () => {
    const state = { currentStreak: 6, longestStreak: 6, lastPlayedDate: new Date("2026-09-22T08:00:00Z") };
    const result = updateStreakForPlay(state, new Date("2026-09-23T02:00:00Z"));
    expect(result.currentStreak).toBe(7);
    expect(result.longestStreak).toBe(7);
  });
});
