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
    expect(afterFirst.handHistory[0]!.settlement.winnerId).toBe("user-a");

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
