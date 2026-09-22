import { isSameUtcDay, missionForDate } from "./dailyMission";

describe("missionForDate", () => {
  it("is deterministic for the same calendar day regardless of time of day", () => {
    const a = missionForDate(new Date("2026-09-22T00:05:00Z"));
    const b = missionForDate(new Date("2026-09-22T23:55:00Z"));
    expect(a.key).toBe(b.key);
  });

  it("can differ on a different day (rotates, doesn't always land on the same mission)", () => {
    const day1 = missionForDate(new Date("2026-01-01T12:00:00Z"));
    const day2 = missionForDate(new Date("2026-01-02T12:00:00Z"));
    expect(day1.key).not.toBe(day2.key);
  });
});

describe("isSameUtcDay", () => {
  it("is true for two timestamps on the same UTC calendar day", () => {
    expect(isSameUtcDay(new Date("2026-09-22T00:00:01Z"), new Date("2026-09-22T23:59:59Z"))).toBe(true);
  });

  it("is false across a UTC day boundary", () => {
    expect(isSameUtcDay(new Date("2026-09-22T23:59:59Z"), new Date("2026-09-23T00:00:01Z"))).toBe(false);
  });
});
