import { cardId } from "@desmoche/shared";
import { buildShuffledDeck, deal, shuffle } from "./deck";
import { createDeck } from "@desmoche/shared";

function seededRng(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

describe("shuffle", () => {
  it("preserves the exact set of cards, only reordering them", () => {
    const deck = createDeck();
    const shuffled = shuffle(deck, seededRng(42));
    expect(shuffled).toHaveLength(52);
    expect(new Set(shuffled.map(cardId))).toEqual(new Set(deck.map(cardId)));
  });

  it("does not mutate the input array", () => {
    const deck = createDeck();
    const copy = [...deck];
    shuffle(deck, seededRng(1));
    expect(deck).toEqual(copy);
  });
});

describe("buildShuffledDeck", () => {
  it("produces 52 unique cards", () => {
    const deck = buildShuffledDeck(seededRng(7));
    expect(new Set(deck.map(cardId)).size).toBe(52);
  });
});

describe("deal", () => {
  it.each([2, 3, 4])("deals 9 cards to each of %i players", (playerCount) => {
    const deck = buildShuffledDeck(seededRng(playerCount));
    const { hands, stock, discard } = deal(deck, playerCount);
    expect(hands).toHaveLength(playerCount);
    for (const hand of hands) {
      expect(hand).toHaveLength(9);
    }
    expect(discard).toHaveLength(1);
    expect(stock).toHaveLength(52 - playerCount * 9 - 1);
  });

  it("uses every card exactly once", () => {
    const deck = buildShuffledDeck(seededRng(99));
    const { hands, stock, discard } = deal(deck, 4);
    const all = [...hands.flat(), ...stock, ...discard];
    expect(all).toHaveLength(52);
    expect(new Set(all.map(cardId)).size).toBe(52);
  });

  it("rejects an invalid player count", () => {
    const deck = buildShuffledDeck(seededRng(1));
    expect(() => deal(deck, 1)).toThrow();
    expect(() => deal(deck, 5)).toThrow();
  });

  it("rejects a deck too small to deal", () => {
    const deck = buildShuffledDeck(seededRng(1)).slice(0, 10);
    expect(() => deal(deck, 4)).toThrow();
  });
});
