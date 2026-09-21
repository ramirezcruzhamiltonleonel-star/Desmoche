import { computeGuestSummary } from "./guestSummary";
import type { ClientGameState, ClientHandHistoryEntry } from "./clientState";

function baseState(overrides: Partial<ClientGameState>): ClientGameState {
  return {
    code: "ABCDE",
    stakeType: "chips",
    ante: 100,
    autoWinsEnabled: true,
    phase: "hand-over",
    seats: [],
    yourSeatIndex: 0,
    isSpectator: false,
    yourHand: [],
    melds: [],
    stockCount: 0,
    topDiscard: null,
    dealerSeatIndex: 0,
    turnSeatIndex: -1,
    hasDrawnThisTurn: false,
    mustPlaceCard: null,
    pendingDrawnCard: null,
    cambio: null,
    yourCambioSubmitted: false,
    claim: null,
    accumulatedPot: 0,
    handOutcome: null,
    handSettlement: null,
    handHistory: [],
    eventLog: [],
    ...overrides,
  };
}

describe("computeGuestSummary", () => {
  // Regression: bestWinChips used to be the raw settlement.potWon, which
  // double-counts the winner's own ante contribution — reported live as
  // "Tu mejor mano +300" in this modal while the session scoreboard (same
  // hand) correctly showed "+400" was wrong the OTHER way: the modal must
  // show the same NET figure the scoreboard does, not the raw pot.
  it("reports the NET gain (pot minus the winner's own ante), matching what the scoreboard shows for the same hand", () => {
    // 4 players x 100 ante = 400 pot. Winner nets 400 - 100 = 300.
    const entry: ClientHandHistoryEntry = {
      reason: "meld-out",
      winnerSeatIndex: 0,
      settlement: { kind: "chips", winnerId: "me", potWon: 400, extraPerLoser: {}, patonaLoserIds: [] },
      playedAt: Date.now(),
    };
    const state = baseState({ ante: 100, yourSeatIndex: 0, handHistory: [entry] });

    const summary = computeGuestSummary(state);

    expect(summary.bestWinChips).toBe(300);
  });

  it("adds Mico/Patona bonuses collected from losers into the net figure", () => {
    const entry: ClientHandHistoryEntry = {
      reason: "meld-out",
      winnerSeatIndex: 0,
      settlement: {
        kind: "chips",
        winnerId: "me",
        potWon: 400,
        extraPerLoser: { p1: 50, p2: 50, p3: 50 },
        patonaLoserIds: [],
      },
      playedAt: Date.now(),
    };
    const state = baseState({ ante: 100, yourSeatIndex: 0, handHistory: [entry] });

    expect(computeGuestSummary(state).bestWinChips).toBe(400 - 100 + 150);
  });

  it("only counts hands this player actually won, and keeps the single biggest net gain", () => {
    const won: ClientHandHistoryEntry = {
      reason: "meld-out",
      winnerSeatIndex: 0,
      settlement: { kind: "chips", winnerId: "me", potWon: 300, extraPerLoser: {}, patonaLoserIds: [] },
      playedAt: 1,
    };
    const biggerWin: ClientHandHistoryEntry = {
      reason: "meld-out",
      winnerSeatIndex: 0,
      settlement: { kind: "chips", winnerId: "me", potWon: 500, extraPerLoser: {}, patonaLoserIds: [] },
      playedAt: 2,
    };
    const someoneElseWon: ClientHandHistoryEntry = {
      reason: "meld-out",
      winnerSeatIndex: 1,
      settlement: { kind: "chips", winnerId: "someone-else", potWon: 900, extraPerLoser: {}, patonaLoserIds: [] },
      playedAt: 3,
    };
    const state = baseState({
      ante: 100,
      yourSeatIndex: 0,
      handHistory: [won, biggerWin, someoneElseWon],
    });

    const summary = computeGuestSummary(state);
    expect(summary.gamesPlayed).toBe(3);
    expect(summary.gamesWon).toBe(2);
    expect(summary.bestWinChips).toBe(500 - 100); // the bigger of the two wins
  });

  it("is null when no chips-mode hand was ever won (e.g. dare mode, or no wins at all)", () => {
    const dareWin: ClientHandHistoryEntry = {
      reason: "meld-out",
      winnerSeatIndex: 0,
      settlement: { kind: "dare", winnerId: "me", playersWhoOweADare: ["p1"] },
      playedAt: 1,
    };
    const state = baseState({ yourSeatIndex: 0, handHistory: [dareWin] });

    const summary = computeGuestSummary(state);
    expect(summary.gamesWon).toBe(1);
    expect(summary.bestWinChips).toBeNull();
  });
});
