import type { Card, Meld } from "@desmoche/shared";
import type { PrismaClient } from "@prisma/client";
import { createTestDb } from "../testUtils/testDb";
import { Room } from "../rooms/room";
import { persistHandOutcome } from "./handHistory";
import { getUserStats } from "./userStats";

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

async function makeUser(id: string, displayName: string) {
  return prisma.user.create({ data: { id, email: `${id}@example.com`, displayName } });
}

async function playHand(
  code: string,
  winnerId: string,
  loserId: string,
  winningMelds: Meld[] = [],
): Promise<Room> {
  const room = new Room(code, "chips", 100);
  room.join(winnerId, "W");
  room.join(loserId, "L");
  room.setReady(winnerId, true);
  room.setReady(loserId, true);
  const table = room.requireTable();
  (table.state as { phase: string }).phase = "hand-over";
  table.state.handOutcome = { reason: "meld-out", winnerSeatIndex: 0, winningMelds };
  const outcome = room.maybeSettle();
  await persistHandOutcome(prisma, room, outcome!);
  return room;
}

/** Like playHand, but plays a SECOND hand at the exact same table code, in
 * the SAME Room instance — mirrors multiple hands at one real table. */
async function playSecondHandAtSameTable(room: Room): Promise<void> {
  room.nextHand();
  const table = room.requireTable();
  (table.state as { phase: string }).phase = "hand-over";
  table.state.handOutcome = { reason: "meld-out", winnerSeatIndex: 0, winningMelds: [] };
  const outcome = room.maybeSettle();
  await persistHandOutcome(prisma, room, outcome!);
}

describe("getUserStats", () => {
  it("aggregates hands played/won, net chips, and bonus hands across multiple sessions", async () => {
    await makeUser("stats-winner", "Ana");
    await makeUser("stats-loser-1", "Beto");
    await makeUser("stats-loser-2", "Caro");

    // Hand 1: stats-winner wins plainly (no bonus) against loser-1.
    await playHand("STATS1", "stats-winner", "stats-loser-1");
    // Hand 2: stats-winner wins WITH a Mico bonus against loser-2.
    await playHand("STATS2", "stats-winner", "stats-loser-2", [
      { id: "m1", type: "run", ownerId: "stats-winner", cards: [c("A", "clubs"), c("2", "clubs"), c("3", "clubs")] },
    ]);
    // Hand 3: stats-winner LOSES to loser-1.
    await playHand("STATS3", "stats-loser-1", "stats-winner");

    const stats = await getUserStats(prisma, "stats-winner");
    expect(stats.handsPlayed).toBe(3);
    expect(stats.handsWon).toBe(2);
    expect(stats.handsWithBonus).toBe(1);
    // Hand1: +100. Hand2: +200 (100 pot + 100 Mico). Hand3: -100. Net: +200.
    expect(stats.netChipsAllTime).toBe(200);
    // The Mico hand (+200) nets more than the plain one (+100).
    expect(stats.biggestWinChips).toBe(200);
    // 3 hands at 3 different table codes (STATS1/2/3).
    expect(stats.tablesPlayed).toBe(3);

    const loserStats = await getUserStats(prisma, "stats-loser-1");
    expect(loserStats.handsPlayed).toBe(2);
    expect(loserStats.handsWon).toBe(1);
    expect(loserStats.handsWithBonus).toBe(0);
    expect(loserStats.biggestWinChips).toBe(100);
    // STATS1 and STATS3 — 2 distinct tables.
    expect(loserStats.tablesPlayed).toBe(2);
  });

  it("returns all zeros (and a null biggest win) for a user who has never played", async () => {
    await makeUser("stats-nobody", "Nadie");
    const stats = await getUserStats(prisma, "stats-nobody");
    expect(stats).toEqual({
      handsPlayed: 0,
      handsWon: 0,
      netChipsAllTime: 0,
      handsWithBonus: 0,
      biggestWinChips: null,
      tablesPlayed: 0,
    });
  });

  it("counts a table only once no matter how many hands were played there (a fresh TableRecord row is created per hand, but the CODE is what identifies a real table)", async () => {
    await makeUser("stats-regular-winner", "Fabio");
    await makeUser("stats-regular-loser", "Gina");

    const room = await playHand("STATSAME", "stats-regular-winner", "stats-regular-loser");
    await playSecondHandAtSameTable(room);
    await playSecondHandAtSameTable(room);

    const stats = await getUserStats(prisma, "stats-regular-winner");
    expect(stats.handsPlayed).toBe(3);
    expect(stats.tablesPlayed).toBe(1);
  });

  it("is null for a user who has played but never won", async () => {
    await makeUser("stats-always-loses", "Dario");
    await makeUser("stats-always-wins", "Elena");
    await playHand("STATS4", "stats-always-wins", "stats-always-loses");

    const stats = await getUserStats(prisma, "stats-always-loses");
    expect(stats.handsWon).toBe(0);
    expect(stats.biggestWinChips).toBeNull();
  });
});
