import type { Card } from "@desmoche/shared";
import {
  checkAutoWins,
  closestToDealerRight,
  hasCuatroCuerpos,
  isPeladia,
} from "./autoWins";

function c(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

describe("isPeladia", () => {
  it("is true for a hand with no pairs and no adjacent same-suit cards", () => {
    const hand: Card[] = [
      c("2", "spades"),
      c("5", "hearts"),
      c("9", "clubs"),
      c("K", "diamonds"),
      c("4", "spades"),
      c("7", "hearts"),
      c("J", "clubs"),
      c("3", "diamonds"),
      c("8", "spades"),
    ];
    expect(isPeladia(hand)).toBe(true);
  });

  it("is false when the hand has a pair", () => {
    const hand: Card[] = [
      c("2", "spades"),
      c("2", "hearts"),
      c("9", "clubs"),
      c("K", "diamonds"),
      c("4", "spades"),
      c("7", "hearts"),
      c("J", "clubs"),
      c("3", "diamonds"),
      c("8", "spades"),
    ];
    expect(isPeladia(hand)).toBe(false);
  });

  it("is false when two same-suit cards are adjacent", () => {
    const hand: Card[] = [
      c("5", "spades"),
      c("6", "spades"),
      c("9", "clubs"),
      c("K", "diamonds"),
      c("2", "hearts"),
      c("7", "hearts"),
      c("J", "clubs"),
      c("3", "diamonds"),
      c("A", "clubs"),
    ];
    expect(isPeladia(hand)).toBe(false);
  });

  it("treats the Ace as adjacent to both 2 (low) and K (high) of the same suit", () => {
    const lowAceAdjacent: Card[] = [
      c("A", "spades"),
      c("2", "spades"),
      c("9", "clubs"),
      c("K", "diamonds"),
      c("4", "hearts"),
      c("7", "hearts"),
      c("J", "clubs"),
      c("3", "diamonds"),
      c("8", "clubs"),
    ];
    expect(isPeladia(lowAceAdjacent)).toBe(false);

    const highAceAdjacent: Card[] = [
      c("A", "spades"),
      c("K", "spades"),
      c("9", "clubs"),
      c("4", "diamonds"),
      c("2", "hearts"),
      c("7", "hearts"),
      c("J", "clubs"),
      c("3", "diamonds"),
      c("8", "clubs"),
    ];
    expect(isPeladia(highAceAdjacent)).toBe(false);
  });
});

describe("hasCuatroCuerpos", () => {
  it("is true when all four suits of a rank are present", () => {
    const hand: Card[] = [
      c("8", "spades"),
      c("8", "hearts"),
      c("8", "clubs"),
      c("8", "diamonds"),
      c("2", "hearts"),
      c("K", "diamonds"),
      c("4", "spades"),
      c("J", "clubs"),
      c("3", "diamonds"),
    ];
    expect(hasCuatroCuerpos(hand)).toBe(true);
  });

  it("is false otherwise", () => {
    const hand: Card[] = [
      c("8", "spades"),
      c("8", "hearts"),
      c("8", "clubs"),
      c("2", "hearts"),
      c("K", "diamonds"),
      c("4", "spades"),
      c("J", "clubs"),
      c("3", "diamonds"),
      c("9", "clubs"),
    ];
    expect(hasCuatroCuerpos(hand)).toBe(false);
  });
});

describe("closestToDealerRight", () => {
  it("picks the tied candidate nearest the dealer's right", () => {
    expect(closestToDealerRight(0, [1, 3], 4)).toBe(1);
  });

  it("wraps around the table", () => {
    expect(closestToDealerRight(3, [0, 2], 4)).toBe(0);
  });
});

describe("checkAutoWins", () => {
  it("reports all seats qualifying for either auto-win", () => {
    const peladiaHand: Card[] = [
      c("2", "spades"),
      c("5", "hearts"),
      c("9", "clubs"),
      c("K", "diamonds"),
      c("4", "spades"),
      c("7", "hearts"),
      c("J", "clubs"),
      c("3", "diamonds"),
      c("8", "spades"),
    ];
    const normalHand: Card[] = [
      c("5", "spades"),
      c("6", "spades"),
      c("9", "clubs"),
      c("K", "diamonds"),
      c("2", "hearts"),
      c("7", "hearts"),
      c("J", "clubs"),
      c("3", "diamonds"),
      c("A", "clubs"),
    ];
    const result = checkAutoWins([peladiaHand, normalHand]);
    expect(result.peladiaSeatIndices).toEqual([0]);
    expect(result.cuatroCuerposSeatIndices).toEqual([]);
  });
});
