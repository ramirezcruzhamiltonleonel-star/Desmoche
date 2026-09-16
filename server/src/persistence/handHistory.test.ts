import type { Card, Meld } from "@desmoche/shared";
import type { PrismaClient } from "@prisma/client";
import { createTestDb } from "../testUtils/testDb";
import { Room } from "../rooms/room";
import { persistHandOutcome } from "./handHistory";

function c(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

jest.setTimeout(30_000);

let prisma: PrismaClient;
let cleanup: () => Promise<void>;

beforeAll(() => {
  const db = createTestDb();
  prisma = db.prisma;
  cleanup = db.cleanup;
});

afterAll(async () => {
  await cleanup();
});

async function makeUser(id: string, displayName: string, chipBalance = 1000) {
  return prisma.user.create({ data: { id, email: `${id}@example.com`, displayName, chipBalance } });
}

function forceHandOver(room: Room, winnerSeatIndex: number, winningMelds: Meld[] = []) {
  const table = room.requireTable();
  (table.state as { phase: string }).phase = "hand-over";
  table.state.handOutcome = {
    reason: "meld-out",
    winnerSeatIndex,
    winningMelds,
  };
}

describe("persistHandOutcome", () => {
  it("moves chips from losers to the winner and logs a hand history row", async () => {
    await makeUser("winner-1", "Ana", 1000);
    await makeUser("loser-1", "Beto", 1000);

    const room = new Room("CHIPS1", "chips", 100);
    room.join("winner-1", "Ana");
    room.join("loser-1", "Beto");
    room.setReady("winner-1", true);
    room.setReady("loser-1", true);
    forceHandOver(room, 0);

    const outcome = room.maybeSettle();
    expect(outcome).not.toBeNull();
    await persistHandOutcome(prisma, room, outcome!);

    const winner = await prisma.user.findUniqueOrThrow({ where: { id: "winner-1" } });
    const loser = await prisma.user.findUniqueOrThrow({ where: { id: "loser-1" } });
    expect(winner.chipBalance).toBe(1100); // +100 pot from the loser's ante
    expect(loser.chipBalance).toBe(900);

    const hands = await prisma.handHistoryRecord.findMany({
      where: { winnerUserId: "winner-1" },
      include: { players: true },
    });
    expect(hands).toHaveLength(1);
    expect(hands[0]!.players).toHaveLength(2);
    expect(hands[0]!.players.find((p) => p.userId === "winner-1")!.isWinner).toBe(true);
    expect(hands[0]!.players.find((p) => p.userId === "loser-1")!.isWinner).toBe(false);
  });

  it("does not move chips in dare mode, but still logs history", async () => {
    await makeUser("winner-2", "Carla", 1000);
    await makeUser("loser-2", "Dario", 1000);

    const room = new Room("DARE1", "dare", 0);
    room.join("winner-2", "Carla");
    room.join("loser-2", "Dario");
    room.setReady("winner-2", true);
    room.setReady("loser-2", true);
    forceHandOver(room, 0);

    const outcome = room.maybeSettle();
    await persistHandOutcome(prisma, room, outcome!);

    const winner = await prisma.user.findUniqueOrThrow({ where: { id: "winner-2" } });
    const loser = await prisma.user.findUniqueOrThrow({ where: { id: "loser-2" } });
    expect(winner.chipBalance).toBe(1000);
    expect(loser.chipBalance).toBe(1000);
  });

  it("records bonusChipsCollected on the winner's row only, separate from the base pot", async () => {
    await makeUser("winner-3", "Elena", 1000);
    await makeUser("loser-3", "Pedro", 1000);

    const room = new Room("CHIPS2", "chips", 100);
    room.join("winner-3", "Elena");
    room.join("loser-3", "Pedro");
    room.setReady("winner-3", true);
    room.setReady("loser-3", true);
    // Mico abajo (A-2-3 clubs) — one extra ante on top of the pot.
    forceHandOver(room, 0, [
      { id: "m1", type: "run", ownerId: "winner-3", cards: [c("A", "clubs"), c("2", "clubs"), c("3", "clubs")] },
    ]);

    const outcome = room.maybeSettle();
    await persistHandOutcome(prisma, room, outcome!);

    const hand = await prisma.handHistoryRecord.findFirstOrThrow({
      where: { winnerUserId: "winner-3" },
      include: { players: true },
    });
    const winnerRow = hand.players.find((p) => p.userId === "winner-3")!;
    const loserRow = hand.players.find((p) => p.userId === "loser-3")!;
    expect(winnerRow.bonusChipsCollected).toBe(100); // the Mico extra, not the 200 total pot
    expect(winnerRow.chipsDelta).toBe(200); // (potWon 200 - own ante 100) + 100 bonus
    expect(loserRow.bonusChipsCollected).toBe(0);
  });
});
