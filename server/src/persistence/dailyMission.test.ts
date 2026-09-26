import { isSameManaguaDay, missionForDate } from "./dailyMission";

describe("missionForDate", () => {
  it("is deterministic for the same Managua calendar day regardless of time of day", () => {
    const a = missionForDate(new Date("2026-09-22T06:05:00Z")); // 00:05 Managua
    const b = missionForDate(new Date("2026-09-23T05:55:00Z")); // 23:55 Managua, same day
    expect(a.key).toBe(b.key);
  });

  it("can differ on a different day (rotates, doesn't always land on the same mission)", () => {
    const day1 = missionForDate(new Date("2026-01-01T12:00:00Z"));
    const day2 = missionForDate(new Date("2026-01-02T12:00:00Z"));
    expect(day1.key).not.toBe(day2.key);
  });
});

describe("isSameManaguaDay", () => {
  // Managua is UTC-6 year-round — its midnight is 06:00 UTC, not 00:00 UTC.
  // Streaks/missions cutting over at plain UTC midnight (6pm in Managua)
  // was a reported bug: a day could turn over mid-evening for a Nicaraguan
  // player still mid-session.
  it("is true for two timestamps on the same Managua calendar day, even though they're on different UTC calendar days", () => {
    expect(isSameManaguaDay(new Date("2026-09-22T06:00:01Z"), new Date("2026-09-23T05:59:59Z"))).toBe(true);
  });

  it("is false across the real Managua day boundary (06:00 UTC)", () => {
    expect(isSameManaguaDay(new Date("2026-09-23T05:59:59Z"), new Date("2026-09-23T06:00:01Z"))).toBe(false);
  });

  it("is false for two timestamps that share a UTC calendar day but straddle the Managua boundary", () => {
    // Both "2026-09-22" in UTC, but 05:59 is still "2026-09-21" in Managua
    // while 06:01 is already "2026-09-22" — the old UTC-only logic would
    // have wrongly called these the same day.
    expect(isSameManaguaDay(new Date("2026-09-22T05:59:00Z"), new Date("2026-09-22T06:01:00Z"))).toBe(false);
  });
});
