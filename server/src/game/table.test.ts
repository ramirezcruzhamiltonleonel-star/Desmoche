import { cardId, createDeck, type Card } from "@desmoche/shared";
import { Table } from "./table";
import { GameError } from "./errors";
import type { Seat, TableConfig } from "./state";

function c(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

function seats(count: number): Seat[] {
  return Array.from({ length: count }, (_, i) => ({
    seatIndex: i,
    playerId: `p${i}`,
    displayName: `Player ${i}`,
    connected: true,
    ready: true,
  }));
}

function config(overrides: Partial<TableConfig> = {}): TableConfig {
  return { code: "ABCD", stakeType: "chips", ante: 100, ...overrides };
}

/**
 * Interleaves per-seat hands round-robin the way `deal()` expects, appends
 * the up-card, then tops up with the rest of the 52-card deck as stock so
 * there are always real cards left to draw.
 */
function buildDeck(hands: Card[][], upCard: Card): Card[] {
  const deck: Card[] = [];
  for (let round = 0; round < 9; round++) {
    for (const hand of hands) {
      deck.push(hand[round]!);
    }
  }
  deck.push(upCard);

  const used = new Set([...hands.flat(), upCard].map(cardId));
  const leftover = createDeck().filter((card) => !used.has(cardId(card)));
  deck.push(...leftover);
  return deck;
}

const PELADIA_HAND: Card[] = [
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

const NORMAL_HAND: Card[] = [
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

describe("Table — dealing and auto-wins", () => {
  it("ends the hand immediately on a Peladía", () => {
    const table = new Table(config(), seats(2));
    const deck = buildDeck([PELADIA_HAND, NORMAL_HAND], c("4", "diamonds"));
    table.startHand(0, deck);

    expect(table.state.phase).toBe("hand-over");
    expect(table.state.handOutcome).toEqual({
      reason: "peladia",
      winnerSeatIndex: 0,
      winningMelds: [],
    });
  });

  it("breaks a Cuatro Cuerpos tie in favor of the seat closest to the dealer's right", () => {
    const cuatroA: Card[] = [
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
    const cuatroB: Card[] = [
      c("Q", "spades"),
      c("Q", "hearts"),
      c("Q", "clubs"),
      c("Q", "diamonds"),
      c("2", "clubs"),
      c("5", "diamonds"),
      c("4", "hearts"),
      c("J", "hearts"),
      c("3", "spades"),
    ];
    const table = new Table(config(), seats(3));
    const deck = buildDeck([cuatroA, NORMAL_HAND, cuatroB], c("4", "diamonds"));
    table.startHand(0, deck);

    expect(table.state.handOutcome?.reason).toBe("cuatro-cuerpos");
    expect(table.state.handOutcome?.winnerSeatIndex).toBe(2);
  });

  it("otherwise opens a claim window on the flipped-up card", () => {
    const table = new Table(config(), seats(2));
    const deck = buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds"));
    table.startHand(0, deck);

    expect(table.state.phase).toBe("claim-window");
    expect(table.state.claim).toMatchObject({
      isInitialFlip: true,
      referenceSeatIndex: 0,
      fallbackSeatIndex: 1,
      pendingSeatIndices: [0, 1],
    });
  });
});

describe("Table — first-turn double draw", () => {
  it("gives the first player 2 stock cards when nobody claims the initial flip", () => {
    const table = new Table(config(), seats(2));
    const deck = buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds"));
    table.startHand(0, deck);

    table.respondToClaim("p0", "pass");
    table.respondToClaim("p1", "pass");

    expect(table.state.phase).toBe("turn-active");
    expect(table.state.turnSeatIndex).toBe(1);

    const drawn = table.drawFromStock("p1");
    expect(drawn).toHaveLength(2);
    expect(table.state.phase).toBe("first-turn-choice");

    table.chooseFirstTurnCard("p1", drawn[0]!);
    expect(table.state.phase).toBe("turn-active");
    expect(table.state.hasDrawnThisTurn).toBe(true);
    expect(table.state.discard[table.state.discard.length - 1]).toEqual(drawn[1]);
  });

  it("draws only 1 stock card on later turns", () => {
    const table = new Table(config(), seats(2));
    const deck = buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds"));
    table.startHand(0, deck);
    table.forceResolveClaimWindow();
    const drawn = table.drawFromStock("p1");
    expect(drawn).toHaveLength(2);
    table.chooseFirstTurnCard("p1", drawn[0]!);
    table.discard("p1", table.state.hands["p1"]![0]!);
    table.forceResolveClaimWindow();

    const secondDraw = table.drawFromStock("p0");
    expect(secondDraw).toHaveLength(1);
  });
});

describe("Table — claiming a discard out of turn", () => {
  it("jumps the turn to the claimant and resumes after them afterward", () => {
    // 3 players: seat0 discards, seat2 claims out of turn (skipping seat1).
    const hand0 = [
      c("2", "spades"),
      c("3", "spades"),
      c("4", "spades"),
      c("9", "clubs"),
      c("K", "diamonds"),
      c("6", "hearts"),
      c("J", "clubs"),
      c("3", "diamonds"),
      c("A", "hearts"),
    ];
    const hand1: Card[] = [
      c("5", "spades"),
      c("6", "spades"),
      c("9", "hearts"),
      c("K", "clubs"),
      c("2", "hearts"),
      c("7", "hearts"),
      c("J", "hearts"),
      c("3", "hearts"),
      c("A", "clubs"),
    ];
    // seat2 can use an 8 of clubs to extend a hand set of 8s.
    const hand2: Card[] = [
      c("8", "hearts"),
      c("8", "diamonds"),
      c("9", "diamonds"),
      c("Q", "clubs"),
      c("2", "clubs"),
      c("7", "clubs"),
      c("J", "diamonds"),
      c("4", "hearts"),
      c("5", "hearts"),
    ];
    const table = new Table(config(), seats(3));
    const deck = buildDeck([hand0, hand1, hand2], c("4", "diamonds"));
    table.startHand(0, deck);
    // Nobody wants the initial flip — send everyone through the first turn normally.
    table.forceResolveClaimWindow();
    table.drawFromStock("p1"); // seat1 is dealer(0)+1 => first player
    table.chooseFirstTurnCard("p1", table.state.hands["p1"]![9]!);
    // seat1 discards an 8 of clubs, which seat2 (not seat0 the dealer) can claim.
    table.state.hands["p1"] = [...table.state.hands["p1"]!, c("8", "clubs")];
    table.discard("p1", c("8", "clubs"));

    expect(table.state.phase).toBe("claim-window");
    table.respondToClaim("p2", "claim");
    table.respondToClaim("p0", "pass");

    expect(table.state.phase).toBe("turn-active");
    expect(table.state.turnSeatIndex).toBe(2);
    expect(table.state.mustPlaceCard).toEqual(c("8", "clubs"));

    // Must place the claimed card before discarding.
    expect(() => table.discard("p2", table.state.hands["p2"]![0]!)).toThrow(GameError);

    table.placeMeld("p2", [c("8", "hearts"), c("8", "diamonds"), c("8", "clubs")]);
    table.discard("p2", c("9", "diamonds"));

    // Rotation resumes from the seat AFTER the claimant (seat0), skipping seat1.
    table.forceResolveClaimWindow();
    expect(table.state.turnSeatIndex).toBe(0);
  });
});

describe("Table — desmoche", () => {
  it("refuses to shrink a source meld below 3 cards", () => {
    const table = new Table(config(), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    table.forceResolveClaimWindow();
    table.drawFromStock("p1");
    table.chooseFirstTurnCard("p1", table.state.hands["p1"]![9]!);

    table.state.melds.push(
      { id: "m1", type: "set", ownerId: "p1", cards: [c("8", "spades"), c("8", "hearts"), c("8", "clubs")] },
      { id: "m2", type: "run", ownerId: "p1", cards: [c("5", "diamonds"), c("6", "diamonds"), c("7", "diamonds")] },
    );

    expect(() => table.desmochar("p1", "m1", "m2", c("8", "spades"))).toThrow(GameError);
  });

  it("allows moving a card out of a 4-card meld into another valid meld", () => {
    const table = new Table(config(), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    table.forceResolveClaimWindow();
    table.drawFromStock("p1");
    table.chooseFirstTurnCard("p1", table.state.hands["p1"]![9]!);

    table.state.melds.push(
      {
        id: "m1",
        type: "run",
        ownerId: "p1",
        cards: [c("5", "diamonds"), c("6", "diamonds"), c("7", "diamonds"), c("8", "diamonds")],
      },
      { id: "m2", type: "set", ownerId: "p1", cards: [c("8", "spades"), c("8", "hearts")] },
    );

    table.desmochar("p1", "m1", "m2", c("8", "diamonds"));

    const m1 = table.state.melds.find((m) => m.id === "m1")!;
    const m2 = table.state.melds.find((m) => m.id === "m2")!;
    expect(m1.cards).toHaveLength(3);
    expect(m2.cards).toHaveLength(3);
  });
});

describe("Table — meld-out win and settlement", () => {
  it("ends the hand the instant the hand is emptied, without a discard", () => {
    const table = new Table(config({ ante: 100 }), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    table.forceResolveClaimWindow();
    table.drawFromStock("p1");
    table.chooseFirstTurnCard("p1", table.state.hands["p1"]![9]!);

    // Force a hand p1 can fully meld: 3 runs of 3.
    table.state.hands["p1"] = [
      c("A", "clubs"),
      c("2", "clubs"),
      c("3", "clubs"),
      c("5", "hearts"),
      c("6", "hearts"),
      c("7", "hearts"),
      c("9", "diamonds"),
      c("10", "diamonds"),
      c("J", "diamonds"),
    ];

    table.placeMeld("p1", [c("A", "clubs"), c("2", "clubs"), c("3", "clubs")]);
    table.placeMeld("p1", [c("5", "hearts"), c("6", "hearts"), c("7", "hearts")]);
    table.placeMeld("p1", [c("9", "diamonds"), c("10", "diamonds"), c("J", "diamonds")]);

    expect(table.state.phase).toBe("hand-over");
    expect(table.state.handOutcome?.reason).toBe("meld-out");
    expect(table.state.handOutcome?.winnerSeatIndex).toBe(1);

    const outcome = table.settleHand();
    expect(outcome).toEqual({
      kind: "chips",
      winnerId: "p1",
      potWon: 200,
      extraPerLoser: { p0: 100 }, // Mico abajo (A-2-3 clubs) charges each loser one ante extra
    });
  });
});
