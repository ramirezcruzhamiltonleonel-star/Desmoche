import { isReactionEmoji, REACTION_EMOJIS } from "./socketEvents";

describe("isReactionEmoji", () => {
  it("accepts every allowlisted reaction", () => {
    for (const emoji of REACTION_EMOJIS) {
      expect(isReactionEmoji(emoji)).toBe(true);
    }
  });

  it("rejects anything not on the allowlist — the client's own types are never trusted at runtime", () => {
    expect(isReactionEmoji("💩")).toBe(false);
    expect(isReactionEmoji("hello")).toBe(false);
    expect(isReactionEmoji("<script>alert(1)</script>")).toBe(false);
    expect(isReactionEmoji("")).toBe(false);
  });
});
