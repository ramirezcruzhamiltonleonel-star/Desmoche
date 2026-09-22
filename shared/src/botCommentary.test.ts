import { formatMeldCommentary } from "./botCommentary";
import type { Card } from "./cards";

function c(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

describe("formatMeldCommentary", () => {
  it("names a set of jacks naturally, not the raw rank letter", () => {
    expect(formatMeldCommentary("set", [c("J", "spades"), c("J", "hearts"), c("J", "diamonds")])).toBe(
      "tercia de jotas",
    );
  });

  it("names a set of queens/kings/aces naturally too", () => {
    expect(formatMeldCommentary("set", [c("Q", "spades"), c("Q", "hearts"), c("Q", "diamonds")])).toBe(
      "tercia de reinas",
    );
    expect(formatMeldCommentary("set", [c("K", "spades"), c("K", "hearts"), c("K", "diamonds")])).toBe(
      "tercia de reyes",
    );
    expect(formatMeldCommentary("set", [c("A", "spades"), c("A", "hearts"), c("A", "diamonds")])).toBe(
      "tercia de ases",
    );
  });

  it("keeps a numeric-rank set's number as-is (already reads naturally)", () => {
    expect(formatMeldCommentary("set", [c("8", "spades"), c("8", "hearts"), c("8", "diamonds")])).toBe(
      "tercia de 8",
    );
  });

  it("describes a run by suit and span, with no leftover card-count suffix", () => {
    const text = formatMeldCommentary("run", [c("5", "hearts"), c("6", "hearts"), c("7", "hearts")]);
    expect(text).not.toMatch(/\(\d+\)/);
    expect(text).toContain("5-7");
  });
});
