import type { Card } from "@desmoche/shared";
import {
  decideClaimResponse,
  decideTurnAction,
  fallbackBotAction,
  isBotPlayerId,
  leastUsefulCard,
  nextBotAction,
} from "./bot";
import type { GameState, Seat } from "./state";

function c(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

function baseState(overrides: Partial<GameState> = {}): GameState {
  const seats: Seat[] = [
    { seatIndex: 0, playerId: "p0", displayName: "Ana", connected: true, ready: true },
    { seatIndex: 1, playerId: "bot:fernando", displayName: "🤖 Fernando", connected: true, ready: true },
  ];
  return {
    phase: "turn-active",
    seats,
    hands: {
      p0: [c("2", "spades"), c("3", "spades")],
      "bot:fernando": [c("4", "hearts"), c("5", "hearts"), c("6", "hearts")],
    },
    melds: [],
    stock: [c("7", "clubs"), c("8", "clubs")],
    discard: [c("9", "diamonds"), c("10", "diamonds")],
    dealerSeatIndex: 0,
    turnSeatIndex: 1,
    hasDrawnThisTurn: true,
    mustPlaceCard: null,
    pendingDrawnCard: null,
    cambio: null,
    claim: null,
    inactiveSeatIndices: [],
    accumulatedPot: 0,
    handOutcome: null,
    eventLog: [],
    ...overrides,
  };
}

describe("isBotPlayerId", () => {
  it("recognizes the bot: prefix and nothing else", () => {
    expect(isBotPlayerId("bot:fernando")).toBe(true);
    expect(isBotPlayerId("p0")).toBe(false);
    expect(isBotPlayerId("some-real-uuid")).toBe(false);
  });
});

describe("leastUsefulCard", () => {
  it("picks the isolated card over one that's part of a pair", () => {
    const hand = [c("7", "clubs"), c("7", "hearts"), c("K", "spades")];
    expect(leastUsefulCard(hand)).toEqual(c("K", "spades"));
  });

  it("picks the isolated card over one that's part of a near-run", () => {
    const hand = [c("5", "spades"), c("6", "spades"), c("Q", "diamonds")];
    expect(leastUsefulCard(hand)).toEqual(c("Q", "diamonds"));
  });
});

describe("decideClaimResponse", () => {
  it("claims when the discard completes a meld immediately", () => {
    const state = baseState({
      phase: "claim-window",
      hands: { p0: [], "bot:fernando": [c("4", "hearts"), c("5", "hearts")] },
      claim: {
        card: c("6", "hearts"),
        referenceSeatIndex: 0,
        pendingSeatIndices: [1],
        claimedBy: [],
        fallbackSeatIndex: 1,
        isInitialFlip: false,
      },
    });
    expect(decideClaimResponse(state, "bot:fernando")).toBe("claim");
  });

  it("passes when the discard doesn't help at all", () => {
    const state = baseState({
      phase: "claim-window",
      hands: { p0: [], "bot:fernando": [c("4", "hearts"), c("9", "clubs")] },
      claim: {
        card: c("K", "diamonds"),
        referenceSeatIndex: 0,
        pendingSeatIndices: [1],
        claimedBy: [],
        fallbackSeatIndex: 1,
        isInitialFlip: false,
      },
    });
    expect(decideClaimResponse(state, "bot:fernando")).toBe("pass");
  });
});

describe("decideTurnAction", () => {
  it("draws from stock first if it hasn't drawn yet this turn", () => {
    const state = baseState({ hasDrawnThisTurn: false });
    expect(decideTurnAction(state, "bot:fernando")).toEqual({ type: "draw-stock" });
  });

  it("places a brand-new meld including the pending drawn card, when one exists", () => {
    const state = baseState({
      hands: { p0: [], "bot:fernando": [c("4", "hearts"), c("5", "hearts")] },
      pendingDrawnCard: c("6", "hearts"),
    });
    const action = decideTurnAction(state, "bot:fernando");
    expect(action.type).toBe("place-meld");
    if (action.type === "place-meld") {
      expect(action.cards).toEqual(
        expect.arrayContaining([c("4", "hearts"), c("5", "hearts"), c("6", "hearts")]),
      );
    }
  });

  it("extends its own meld with the pending drawn card, when that's the only fit", () => {
    const state = baseState({
      hands: { p0: [], "bot:fernando": [c("9", "clubs")] },
      melds: [{ id: "m1", type: "run", ownerId: "bot:fernando", cards: [c("4", "hearts"), c("5", "hearts"), c("6", "hearts")] }],
      pendingDrawnCard: c("7", "hearts"),
    });
    expect(decideTurnAction(state, "bot:fernando")).toEqual({
      type: "extend-meld",
      meldId: "m1",
      cards: [c("7", "hearts")],
    });
  });

  it("discards the pending drawn card back when it's useless", () => {
    const state = baseState({
      hands: { p0: [], "bot:fernando": [c("9", "clubs")] },
      pendingDrawnCard: c("K", "diamonds"),
    });
    expect(decideTurnAction(state, "bot:fernando")).toEqual({
      type: "discard",
      card: c("K", "diamonds"),
    });
  });

  it("resolves a mustPlaceCard (claimed from discard) the same way", () => {
    const state = baseState({
      hands: { p0: [], "bot:fernando": [c("4", "hearts"), c("5", "hearts")] },
      mustPlaceCard: c("6", "hearts"),
    });
    const action = decideTurnAction(state, "bot:fernando");
    expect(action.type).toBe("place-meld");
  });

  it("places any other complete meld sitting in hand once the drawn card is resolved", () => {
    const state = baseState({
      hands: {
        p0: [],
        "bot:fernando": [c("K", "clubs"), c("K", "hearts"), c("K", "spades"), c("2", "diamonds")],
      },
    });
    const action = decideTurnAction(state, "bot:fernando");
    expect(action).toEqual({
      type: "place-meld",
      cards: expect.arrayContaining([c("K", "clubs"), c("K", "hearts"), c("K", "spades")]),
    });
  });

  it("extends its own meld with a hand card when no new meld is available", () => {
    const state = baseState({
      hands: { p0: [], "bot:fernando": [c("7", "hearts"), c("2", "diamonds")] },
      melds: [{ id: "m1", type: "run", ownerId: "bot:fernando", cards: [c("4", "hearts"), c("5", "hearts"), c("6", "hearts")] }],
    });
    expect(decideTurnAction(state, "bot:fernando")).toEqual({
      type: "extend-meld",
      meldId: "m1",
      cards: [c("7", "hearts")],
    });
  });

  it("discards the least useful card when nothing can be placed or desmochado", () => {
    const state = baseState({
      hands: { p0: [], "bot:fernando": [c("2", "spades"), c("9", "clubs"), c("K", "diamonds")] },
    });
    const action = decideTurnAction(state, "bot:fernando");
    expect(action.type).toBe("discard");
  });

  it("desmocha only when it directly frees a hand card to be placed, not just because it can", () => {
    // m1 (8s, all 4 suits) can shed a card without breaking — sets don't
    // care which card leaves, unlike runs. Moving 8-hearts onto m2 (5-6-7
    // hearts) makes it a 4-card run; only THEN does the 9-hearts in hand
    // become placeable (it doesn't fit either meld as they start out).
    const state = baseState({
      hands: { p0: [], "bot:fernando": [c("9", "hearts")] },
      melds: [
        {
          id: "m1",
          type: "set",
          ownerId: "bot:fernando",
          cards: [c("8", "clubs"), c("8", "spades"), c("8", "diamonds"), c("8", "hearts")],
        },
        {
          id: "m2",
          type: "run",
          ownerId: "bot:fernando",
          cards: [c("5", "hearts"), c("6", "hearts"), c("7", "hearts")],
        },
      ],
    });
    expect(decideTurnAction(state, "bot:fernando")).toEqual({
      type: "desmochar",
      fromMeldId: "m1",
      toMeldId: "m2",
      card: c("8", "hearts"),
    });
  });

  it("does not desmocha when no hand card would benefit, even though a move is possible", () => {
    const state = baseState({
      hands: { p0: [], "bot:fernando": [c("K", "diamonds")] },
      melds: [
        {
          id: "m1",
          type: "set",
          ownerId: "bot:fernando",
          cards: [c("8", "clubs"), c("8", "spades"), c("8", "diamonds"), c("8", "hearts")],
        },
        {
          id: "m2",
          type: "run",
          ownerId: "bot:fernando",
          cards: [c("5", "hearts"), c("6", "hearts"), c("7", "hearts")],
        },
      ],
    });
    // K-diamonds benefits from nothing here — the bot should just discard it
    // rather than rearranging its own melds for no reason.
    expect(decideTurnAction(state, "bot:fernando")).toEqual({
      type: "discard",
      card: c("K", "diamonds"),
    });
  });
});

describe("nextBotAction", () => {
  it("returns null when it's a human's turn", () => {
    const state = baseState({ turnSeatIndex: 0 });
    expect(nextBotAction(state)).toBeNull();
  });

  it("picks the bot's Cambio submission when it hasn't submitted yet", () => {
    const state = baseState({
      phase: "cambio",
      hands: { p0: [c("2", "spades")], "bot:fernando": [c("9", "clubs"), c("K", "diamonds")] },
      cambio: { submitted: {} },
    });
    const result = nextBotAction(state);
    expect(result?.playerId).toBe("bot:fernando");
    expect(result?.action.type).toBe("submit-cambio-card");
  });

  it("skips a bot that already submitted Cambio", () => {
    const state = baseState({
      phase: "cambio",
      hands: { p0: [c("2", "spades")], "bot:fernando": [c("9", "clubs")] },
      cambio: { submitted: { "bot:fernando": c("K", "diamonds") } },
    });
    expect(nextBotAction(state)).toBeNull();
  });

  it("responds to a pending claim window for the bot's seat", () => {
    const state = baseState({
      phase: "claim-window",
      hands: { p0: [], "bot:fernando": [c("4", "hearts"), c("9", "clubs")] },
      claim: {
        card: c("K", "diamonds"),
        referenceSeatIndex: 0,
        pendingSeatIndices: [1],
        claimedBy: [],
        fallbackSeatIndex: 1,
        isInitialFlip: false,
      },
    });
    const result = nextBotAction(state);
    expect(result).toEqual({ playerId: "bot:fernando", action: { type: "respond-claim", response: "pass" } });
  });

  it("does nothing when the claim window is only waiting on a human", () => {
    const state = baseState({
      phase: "claim-window",
      claim: {
        card: c("K", "diamonds"),
        referenceSeatIndex: 1,
        pendingSeatIndices: [0],
        claimedBy: [],
        fallbackSeatIndex: 0,
        isInitialFlip: false,
      },
    });
    expect(nextBotAction(state)).toBeNull();
  });

  it("acts on the bot's active turn", () => {
    const state = baseState({ hasDrawnThisTurn: false });
    expect(nextBotAction(state)).toEqual({ playerId: "bot:fernando", action: { type: "draw-stock" } });
  });
});

describe("fallbackBotAction", () => {
  it("always returns a legal action for each phase it covers", () => {
    expect(fallbackBotAction(baseState({ phase: "cambio" }), "bot:fernando")).toEqual({
      type: "submit-cambio-card",
      card: c("4", "hearts"),
    });
    expect(fallbackBotAction(baseState({ phase: "claim-window" }), "bot:fernando")).toEqual({
      type: "respond-claim",
      response: "pass",
    });
    expect(fallbackBotAction(baseState({ hasDrawnThisTurn: false }), "bot:fernando")).toEqual({
      type: "draw-stock",
    });
    expect(
      fallbackBotAction(baseState({ pendingDrawnCard: c("Q", "spades") }), "bot:fernando"),
    ).toEqual({ type: "discard", card: c("Q", "spades") });
  });
});
