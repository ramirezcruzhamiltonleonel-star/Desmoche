import { createGuestPlayerId, isGuestPlayerId } from "./guestId";

describe("guestId", () => {
  it("creates ids with the guest: prefix", () => {
    expect(createGuestPlayerId()).toMatch(/^guest:/);
  });

  it("creates a fresh id every call", () => {
    expect(createGuestPlayerId()).not.toBe(createGuestPlayerId());
  });

  it("recognizes the guest: prefix and nothing else", () => {
    expect(isGuestPlayerId("guest:abc-123")).toBe(true);
    expect(isGuestPlayerId("bot:fernando")).toBe(false);
    expect(isGuestPlayerId("some-real-uuid")).toBe(false);
  });
});
