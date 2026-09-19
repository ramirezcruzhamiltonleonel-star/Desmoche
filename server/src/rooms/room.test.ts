import { GameError } from "../game/errors";
import { Room } from "./room";

function makeRoom(): Room {
  return new Room("ABCDE", "chips", 100);
}

describe("Room — lobby", () => {
  it("assigns sequential seats on join", () => {
    const room = makeRoom();
    room.join("user-a", "Ana");
    room.join("user-b", "Beto");

    const view = room.viewFor("user-a");
    expect(view.phase).toBe("lobby");
    expect(view.seats.map((s) => s.displayName)).toEqual(["Ana", "Beto"]);
  });

  it("rejects a 5th distinct player", () => {
    const room = makeRoom();
    room.join("a", "A");
    room.join("b", "B");
    room.join("c", "C");
    room.join("d", "D");
    expect(() => room.join("e", "E")).toThrow(GameError);
  });

  it("re-joining with the same user id reactivates the existing seat instead of adding a new one", () => {
    const room = makeRoom();
    room.join("user-a", "Ana");
    room.setConnected("user-a", false);

    room.join("user-a", "Ana (otra pestaña)");

    const view = room.viewFor("user-a");
    expect(view.seats).toHaveLength(1);
    expect(view.seats[0]!.connected).toBe(true);
    // The original display name sticks — re-joining doesn't rename the seat.
    expect(view.seats[0]!.displayName).toBe("Ana");
  });

  it("starts the game once every seated player is ready (2+)", () => {
    const room = makeRoom();
    room.join("user-a", "Ana");
    room.join("user-b", "Beto");

    room.setReady("user-a", true);
    expect(room.hasStarted).toBe(false);

    room.setReady("user-b", true);
    expect(room.hasStarted).toBe(true);

    const view = room.viewFor("user-a");
    expect(view.phase).not.toBe("lobby");
  });

  it("does not start with only 1 player ready", () => {
    const room = makeRoom();
    room.join("user-a", "Ana");
    room.join("user-b", "Beto");
    room.setReady("user-a", true);
    expect(room.hasStarted).toBe(false);
  });

  it("refuses new joins once the game has started", () => {
    const room = makeRoom();
    room.join("user-a", "Ana");
    room.join("user-b", "Beto");
    room.setReady("user-a", true);
    room.setReady("user-b", true);

    expect(() => room.join("user-c", "Carlos")).toThrow(GameError);
  });
});

describe('Room — "modo sin automáticas"', () => {
  it("defaults to enabled when the room is created without specifying it", () => {
    const room = makeRoom();
    expect(room.autoWinsEnabled).toBe(true);
  });

  it("threads the chosen value through to the live table's config", () => {
    const room = new Room("ABCDE", "chips", 100, false);
    room.join("user-a", "Ana");
    room.join("user-b", "Beto");
    room.setReady("user-a", true);
    room.setReady("user-b", true);

    expect(room.requireTable().config.autoWinsEnabled).toBe(false);
  });

  it("exposes the setting in every viewFor, lobby and in-hand alike", () => {
    const room = new Room("ABCDE", "chips", 100, false);
    room.join("user-a", "Ana");
    expect(room.viewFor("user-a").autoWinsEnabled).toBe(false);

    room.join("user-b", "Beto");
    room.setReady("user-a", true);
    room.setReady("user-b", true);
    expect(room.viewFor("user-a").autoWinsEnabled).toBe(false);
  });
});

describe("Room — bots", () => {
  it("lets the creator add a bot, filling the next seat and marking it ready", () => {
    const room = makeRoom();
    room.join("user-a", "Ana");
    room.addBot("user-a");

    const view = room.viewFor("user-a");
    expect(view.seats).toHaveLength(2);
    const bot = view.seats[1]!;
    expect(bot.isBot).toBe(true);
    expect(bot.ready).toBe(true);
    expect(bot.connected).toBe(true);
  });

  it("refuses to let a non-creator add a bot", () => {
    const room = makeRoom();
    room.join("user-a", "Ana");
    room.join("user-b", "Beto");
    expect(() => room.addBot("user-b")).toThrow(GameError);
  });

  it("refuses to add a bot once the game has started", () => {
    const room = makeRoom();
    room.join("user-a", "Ana");
    room.join("user-b", "Beto");
    room.setReady("user-a", true);
    room.setReady("user-b", true);
    expect(() => room.addBot("user-a")).toThrow(GameError);
  });

  it("never seats the same bot persona twice, and refuses once all are seated", () => {
    const room = makeRoom();
    room.join("user-a", "Ana");
    room.addBot("user-a");
    room.addBot("user-a");
    room.addBot("user-a");

    const ids = room.viewFor("user-a").seats.map((s) => s.playerId);
    expect(new Set(ids).size).toBe(4);
    expect(() => room.addBot("user-a")).toThrow(GameError); // table full (4 seats)
  });

  it("lets the creator remove a bot and re-indexes the remaining seats", () => {
    const room = makeRoom();
    room.join("user-a", "Ana");
    room.addBot("user-a");
    room.addBot("user-a");
    const botId = room.viewFor("user-a").seats[1]!.playerId;

    room.removeBot("user-a", botId);

    const seats = room.viewFor("user-a").seats;
    expect(seats).toHaveLength(2);
    expect(seats.map((s) => s.seatIndex)).toEqual([0, 1]);
    expect(seats.some((s) => s.playerId === botId)).toBe(false);
  });

  it("refuses to let a non-creator remove a bot", () => {
    const room = makeRoom();
    room.join("user-a", "Ana");
    room.join("user-b", "Beto");
    room.addBot("user-a");
    const botId = room.viewFor("user-a").seats[2]!.playerId;
    expect(() => room.removeBot("user-b", botId)).toThrow(GameError);
  });

  it("refuses to remove a seat that isn't a bot", () => {
    const room = makeRoom();
    room.join("user-a", "Ana");
    room.join("user-b", "Beto");
    expect(() => room.removeBot("user-a", "user-b")).toThrow(GameError);
  });
});

describe("Room — connection tracking", () => {
  it("reflects disconnects and reconnects in both the lobby and the live table", () => {
    const room = makeRoom();
    room.join("user-a", "Ana");
    room.join("user-b", "Beto");
    room.setReady("user-a", true);
    room.setReady("user-b", true);

    room.setConnected("user-a", false);
    expect(room.viewFor("user-b").seats.find((s) => s.playerId === "user-a")!.connected).toBe(
      false,
    );

    room.join("user-a", "Ana");
    expect(room.viewFor("user-b").seats.find((s) => s.playerId === "user-a")!.connected).toBe(
      true,
    );
  });

  it("does NOT immediately exclude a mid-hand disconnect from the live table's rotation — a reconnect grace period comes first", () => {
    const room = makeRoom();
    room.join("user-a", "Ana");
    room.join("user-b", "Beto");
    room.setReady("user-a", true);
    room.setReady("user-b", true);

    // A random deal could theoretically auto-win the hand before we get to
    // disconnect anyone — same tolerance the rest of this file already uses.
    if (room.requireTable().state.phase === "hand-over") return;

    room.setConnected("user-b", false);
    // A quick refresh or network blip should never cost a mid-hand player
    // their turn on its own — only the transport layer's grace-period
    // timeout (see index.ts) actually excludes them, by calling
    // excludeFromCurrentHandIfStillDisconnected below.
    expect(room.requireTable().state.inactiveSeatIndices).not.toContain(1);
    const view = room.viewFor("user-a").seats.find((s) => s.playerId === "user-b")!;
    expect(view.connected).toBe(false);
    expect(view.inactiveThisHand).toBe(false);
  });

  it("excludes the seat once the grace period elapses with no reconnection", () => {
    const room = makeRoom();
    room.join("user-a", "Ana");
    room.join("user-b", "Beto");
    room.setReady("user-a", true);
    room.setReady("user-b", true);
    if (room.requireTable().state.phase === "hand-over") return;

    room.setConnected("user-b", false);
    room.excludeFromCurrentHandIfStillDisconnected("user-b"); // simulates the grace timer firing

    expect(room.requireTable().state.inactiveSeatIndices).toContain(1);
    expect(room.viewFor("user-a").seats.find((s) => s.playerId === "user-b")!.inactiveThisHand).toBe(
      true,
    );
  });

  it("does nothing if they reconnected before the grace period elapsed", () => {
    const room = makeRoom();
    room.join("user-a", "Ana");
    room.join("user-b", "Beto");
    room.setReady("user-a", true);
    room.setReady("user-b", true);
    if (room.requireTable().state.phase === "hand-over") return;

    room.setConnected("user-b", false);
    room.join("user-b", "Beto"); // reconnects within the grace window
    room.excludeFromCurrentHandIfStillDisconnected("user-b"); // the (now-stale) timer still fires

    expect(room.requireTable().state.inactiveSeatIndices).not.toContain(1);
    const view = room.viewFor("user-a").seats.find((s) => s.playerId === "user-b")!;
    expect(view.connected).toBe(true);
    expect(view.inactiveThisHand).toBe(false);
  });

  it("still does not restore eligibility for the rest of THIS hand once actually excluded, even after reconnecting", () => {
    const room = makeRoom();
    room.join("user-a", "Ana");
    room.join("user-b", "Beto");
    room.setReady("user-a", true);
    room.setReady("user-b", true);
    if (room.requireTable().state.phase === "hand-over") return;

    room.setConnected("user-b", false);
    room.excludeFromCurrentHandIfStillDisconnected("user-b"); // grace period already elapsed

    room.join("user-b", "Beto"); // reconnects too late for this hand
    expect(room.requireTable().state.inactiveSeatIndices).toContain(1);
    const view = room.viewFor("user-a").seats.find((s) => s.playerId === "user-b")!;
    expect(view.connected).toBe(true);
    expect(view.inactiveThisHand).toBe(true);
  });
});

describe("Room — spectating", () => {
  function startedRoom(): Room {
    const room = makeRoom();
    room.join("user-a", "Ana");
    room.join("user-b", "Beto");
    room.setReady("user-a", true);
    room.setReady("user-b", true);
    return room;
  }

  it("refuses to spectate a table that hasn't started yet", () => {
    const room = makeRoom();
    room.join("user-a", "Ana");
    expect(() => room.spectate("stranger")).toThrow(GameError);
  });

  it("lets a non-seated user watch a table already in progress", () => {
    const room = startedRoom();
    room.spectate("stranger");

    const view = room.viewFor("stranger");
    expect(view.isSpectator).toBe(true);
    expect(view.yourSeatIndex).toBeNull();
    expect(view.yourHand).toEqual([]);
  });

  it("never adds the spectator as a seat, and never shows other seats' hands to them", () => {
    const room = startedRoom();
    room.spectate("stranger");

    expect(room.playerCount).toBe(2);
    const view = room.viewFor("stranger");
    expect(view.seats).toHaveLength(2);
    for (const seat of view.seats) {
      expect(seat.cardCount).toBeGreaterThan(0);
    }
  });

  it("includes the spectator in allSpectatorIds, separate from allPlayerIds", () => {
    const room = startedRoom();
    room.spectate("stranger");

    expect(room.allSpectatorIds()).toEqual(["stranger"]);
    expect(room.allPlayerIds()).not.toContain("stranger");
  });

  it("is a no-op for someone who's already seated", () => {
    const room = startedRoom();
    room.spectate("user-a");

    expect(room.allSpectatorIds()).toEqual([]);
    expect(room.viewFor("user-a").isSpectator).toBe(false);
  });

  it("stops tracking a spectator once they disconnect", () => {
    const room = startedRoom();
    room.spectate("stranger");
    expect(room.allSpectatorIds()).toEqual(["stranger"]);

    room.setConnected("stranger", false);
    expect(room.allSpectatorIds()).toEqual([]);
  });
});

describe("Room — hand progression", () => {
  it("refuses to start the next hand before the game has started", () => {
    const room = makeRoom();
    expect(() => room.nextHand()).toThrow(GameError);
  });

  it("refuses to start the next hand while one is still in progress", () => {
    const room = makeRoom();
    room.join("user-a", "Ana");
    room.join("user-b", "Beto");
    room.setReady("user-a", true);
    room.setReady("user-b", true);

    if (room.requireTable().state.phase !== "hand-over") {
      expect(() => room.nextHand()).toThrow(GameError);
    }
  });

  it("rotates the dealer role one seat per hand, counter-clockwise, starting from whoever created the table", () => {
    const room = makeRoom();
    room.join("user-a", "Ana"); // seat 0 — created the table, deals hand 1
    room.join("user-b", "Beto"); // seat 1
    room.join("user-c", "Caro"); // seat 2
    room.setReady("user-a", true);
    room.setReady("user-b", true);
    room.setReady("user-c", true);

    expect(room.requireTable().state.dealerSeatIndex).toBe(0);

    function forceHandOver(): void {
      const table = room.requireTable();
      (table.state as { phase: string }).phase = "hand-over";
      table.state.handOutcome = { reason: "meld-out", winnerSeatIndex: 0, winningMelds: [] };
    }

    forceHandOver();
    room.nextHand();
    expect(room.requireTable().state.dealerSeatIndex).toBe(1); // seat 1 deals hand 2

    forceHandOver();
    room.nextHand();
    expect(room.requireTable().state.dealerSeatIndex).toBe(2); // seat 2 deals hand 3

    forceHandOver();
    room.nextHand();
    expect(room.requireTable().state.dealerSeatIndex).toBe(0); // wraps back to seat 0, not stuck on seat 2
  });

  it("settles a finished hand exactly once", () => {
    const room = makeRoom();
    room.join("user-a", "Ana");
    room.join("user-b", "Beto");
    room.setReady("user-a", true);
    room.setReady("user-b", true);

    // Force the hand to a known end state regardless of the random deal.
    const table = room.requireTable();
    (table.state as { phase: string }).phase = "hand-over";
    table.state.handOutcome = {
      reason: "meld-out",
      winnerSeatIndex: 0,
      winningMelds: [],
    };

    expect(room.maybeSettle()).not.toBeNull();
    expect(room.maybeSettle()).toBeNull();
  });
});

describe("Room — hand history", () => {
  function forceHandOver(
    room: Room,
    winnerSeatIndex: number,
    reason: "meld-out" | "discard-out" | "peladia" | "cuatro-cuerpos" = "meld-out",
  ) {
    const table = room.requireTable();
    (table.state as { phase: string }).phase = "hand-over";
    table.state.handOutcome = { reason, winnerSeatIndex, winningMelds: [] };
  }

  it("accumulates one entry per finished hand, oldest first, across the whole session", () => {
    const room = makeRoom();
    room.join("user-a", "Ana");
    room.join("user-b", "Beto");
    room.setReady("user-a", true);
    room.setReady("user-b", true);

    forceHandOver(room, 0, "meld-out");
    const afterFirst = room.viewFor("user-a");
    expect(afterFirst.handHistory).toHaveLength(1);
    expect(afterFirst.handHistory[0]).toMatchObject({ reason: "meld-out", winnerSeatIndex: 0 });
    const firstSettlement = afterFirst.handHistory[0]!.settlement;
    if (firstSettlement.kind === "carry-over") throw new Error("expected a real winner, not a carry-over");
    expect(firstSettlement.winnerId).toBe("user-a");

    room.nextHand();
    forceHandOver(room, 1, "discard-out");
    const afterSecond = room.viewFor("user-a");
    expect(afterSecond.handHistory).toHaveLength(2);
    // The first hand's entry is still there — accumulated, not reset.
    expect(afterSecond.handHistory[0]).toMatchObject({ reason: "meld-out", winnerSeatIndex: 0 });
    expect(afterSecond.handHistory[1]).toMatchObject({ reason: "discard-out", winnerSeatIndex: 1 });
  });

  it("does not duplicate an entry across repeated viewFor calls for the same hand", () => {
    const room = makeRoom();
    room.join("user-a", "Ana");
    room.join("user-b", "Beto");
    room.setReady("user-a", true);
    room.setReady("user-b", true);
    forceHandOver(room, 0);

    room.viewFor("user-a");
    room.viewFor("user-b");

    expect(room.viewFor("user-a").handHistory).toHaveLength(1);
  });
});
