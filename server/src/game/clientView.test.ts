import type { Card } from "@desmoche/shared";
import { toClientView } from "./clientView";
import type { GameState, Seat } from "./state";

function c(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

function baseState(overrides: Partial<GameState> = {}): GameState {
  const seats: Seat[] = [
    { seatIndex: 0, playerId: "p0", displayName: "Ana", connected: true, ready: true },
    { seatIndex: 1, playerId: "p1", displayName: "Beto", connected: true, ready: true },
  ];
  return {
    phase: "turn-active",
    seats,
    hands: {
      p0: [c("2", "spades"), c("3", "spades")],
      p1: [c("4", "hearts"), c("5", "hearts"), c("6", "hearts")],
    },
    melds: [],
    stock: [c("7", "clubs"), c("8", "clubs")],
    discard: [c("9", "diamonds"), c("10", "diamonds")],
    dealerSeatIndex: 0,
    turnSeatIndex: 1,
    hasDrawnThisTurn: true,
    mustPlaceCard: null,
    firstTurnChoice: null,
    claim: null,
    isFirstTurn: false,
    handOutcome: null,
    ...overrides,
  };
}

const identity = { code: "ABCD", stakeType: "chips" as const, ante: 100 };

describe("toClientView", () => {
  it("shows the viewer their own hand in full", () => {
    const view = toClientView(baseState(), identity, "p0");
    expect(view.yourHand).toEqual([c("2", "spades"), c("3", "spades")]);
  });

  it("reduces other players to a card count, never exposing their cards", () => {
    const view = toClientView(baseState(), identity, "p0");
    const opponentSeat = view.seats.find((s) => s.playerId === "p1")!;
    expect(opponentSeat.cardCount).toBe(3);
    expect((opponentSeat as unknown as { hand?: unknown }).hand).toBeUndefined();
  });

  it("only exposes the top discard card", () => {
    const view = toClientView(baseState(), identity, "p0");
    expect(view.topDiscard).toEqual(c("10", "diamonds"));
  });

  it("only reveals the pending first-turn choice to the player making it", () => {
    const state = baseState({
      turnSeatIndex: 1,
      firstTurnChoice: [c("A", "spades"), c("K", "hearts")],
    });

    const viewerIsActing = toClientView(state, identity, "p1");
    expect(viewerIsActing.yourFirstTurnChoice).toEqual([c("A", "spades"), c("K", "hearts")]);

    const bystander = toClientView(state, identity, "p0");
    expect(bystander.yourFirstTurnChoice).toBeNull();
  });

  it("reports stock as a count only, never the actual cards", () => {
    const view = toClientView(baseState(), identity, "p0");
    expect(view.stockCount).toBe(2);
  });
});
