import { fallbackBotAction, nextBotAction } from "./bot";
import { Table } from "./table";
import type { Seat, TableConfig } from "./state";
import type { GameAction } from "@desmoche/shared";

function seededRng(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

function botSeats(count: number): Seat[] {
  const ids = ["bot:fernando", "bot:carla", "bot:mateo", "bot:bonus"];
  return Array.from({ length: count }, (_, i) => ({
    seatIndex: i,
    playerId: ids[i]!,
    displayName: ids[i]!,
    connected: true,
    ready: true,
  }));
}

function config(): TableConfig {
  return { code: "ABCD", stakeType: "chips", ante: 100 };
}

function applyAction(table: Table, playerId: string, action: GameAction): void {
  switch (action.type) {
    case "submit-cambio-card":
      table.submitCambioCard(playerId, action.card);
      return;
    case "draw-stock":
      table.drawFromStock(playerId);
      return;
    case "respond-claim":
      table.respondToClaim(playerId, action.response);
      return;
    case "place-meld":
      table.placeMeld(playerId, action.cards);
      return;
    case "extend-meld":
      table.extendMeld(playerId, action.meldId, action.cards);
      return;
    case "desmochar":
      table.desmochar(playerId, action.fromMeldId, action.toMeldId, action.card);
      return;
    case "discard":
      table.discard(playerId, action.card);
      return;
    case "retire-from-hand":
      table.retire(playerId);
      return;
  }
}

/**
 * Drives an all-bot table to completion exactly the way the real server's
 * driveBotsIfNeeded loop would (minus the pacing delay), falling back the
 * same way on a rejected action. Returns the number of steps taken.
 */
function playOutWithBots(table: Table, maxSteps = 500): number {
  for (let step = 0; step < maxSteps; step++) {
    const pending = nextBotAction(table.state);
    if (!pending) return step;
    try {
      applyAction(table, pending.playerId, pending.action);
    } catch {
      const fallback = fallbackBotAction(table.state, pending.playerId);
      if (!fallback) throw new Error("No fallback action available — bot truly stuck");
      applyAction(table, pending.playerId, fallback);
    }
  }
  throw new Error(`Did not reach hand-over within ${maxSteps} bot steps`);
}

describe("bot vs. bot — full hands never stall", () => {
  it.each([2, 3, 4])("plays a complete %i-bot hand to hand-over without ever getting stuck", (n) => {
    const table = new Table(config(), botSeats(n), seededRng(n * 17 + 3));
    table.startHand(0);
    playOutWithBots(table);
    expect(table.state.phase).toBe("hand-over");
    expect(table.state.handOutcome).not.toBeNull();
  });

  it("plays several consecutive hands back to back without stalling", () => {
    const table = new Table(config(), botSeats(3), seededRng(777));
    for (let hand = 0; hand < 5; hand++) {
      table.startHand(hand % 3);
      playOutWithBots(table);
      expect(table.state.phase).toBe("hand-over");
    }
  });

  it("settles cleanly (chips move, no throw) after an all-bot hand", () => {
    const table = new Table(config(), botSeats(2), seededRng(555));
    table.startHand(0);
    playOutWithBots(table);
    expect(() => table.settleHand()).not.toThrow();
  });
});
