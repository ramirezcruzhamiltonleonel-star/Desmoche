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
  return {
    code: "ABCD",
    stakeType: "chips",
    ante: 100,
    autoWinsEnabled: true,
    allowMeldsBeforeResolvingDraw: false,
    ...overrides,
  };
}

/**
 * Cambio is now mandatory right after every deal (unless someone auto-won).
 * Tests that don't care about Cambio itself just need to get past it — each
 * seat hands over its LAST dealt card, which every test below constructs to
 * be a throwaway so the specific cards those tests actually assert on are
 * left untouched.
 */
function resolveCambio(table: Table, playerIds: string[]): void {
  for (const id of playerIds) {
    const hand = table.state.hands[id]!;
    table.submitCambioCard(id, hand[hand.length - 1]!);
  }
}

/**
 * Test-only shortcut: jumps straight past the opening no-claim ritual (the
 * initial flip and the single-card reveal loop that follows it if unclaimed
 * — see "Table — the opening ritual..." below for its own thorough coverage)
 * to a normal turn for the given seat, as if it had already resolved that
 * way for real. Tests that only care about what happens once play is
 * underway use this instead of re-deriving the ritual every time.
 */
function skipToNormalTurn(table: Table, seatIndex: number, hasDrawnThisTurn = false): void {
  table.state.phase = "turn-active";
  table.state.turnSeatIndex = seatIndex;
  table.state.hasDrawnThisTurn = hasDrawnThisTurn;
  table.state.mustPlaceCard = null;
  table.state.pendingDrawnCard = null;
  table.state.claim = null;
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
    resolveCambio(table, ["p0", "p1"]);

    expect(table.state.phase).toBe("claim-window");
    expect(table.state.claim).toMatchObject({
      isInitialFlip: true,
      referenceSeatIndex: 0,
      fallbackSeatIndex: 1,
      pendingSeatIndices: [0, 1],
    });
  });
});

describe('Table — "modo sin automáticas" (autoWinsEnabled: false)', () => {
  it("does not end the hand on a Peladía — goes to Cambio like any other deal", () => {
    const table = new Table(config({ autoWinsEnabled: false }), seats(2));
    const deck = buildDeck([PELADIA_HAND, NORMAL_HAND], c("4", "diamonds"));
    table.startHand(0, deck);

    expect(table.state.phase).toBe("cambio");
    expect(table.state.handOutcome).toBeNull();
  });

  it("does not end the hand on a Cuatro Cuerpos either", () => {
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
    const table = new Table(config({ autoWinsEnabled: false }), seats(2));
    const deck = buildDeck([cuatroA, NORMAL_HAND], c("4", "diamonds"));
    table.startHand(0, deck);

    expect(table.state.phase).toBe("cambio");
    expect(table.state.handOutcome).toBeNull();
  });

  it("still ends a hand normally through meld-out once Cambio and play proceed", () => {
    const table = new Table(config({ autoWinsEnabled: false }), seats(2));
    const deck = buildDeck([PELADIA_HAND, NORMAL_HAND], c("4", "diamonds"));
    table.startHand(0, deck);
    resolveCambio(table, ["p0", "p1"]);

    // Auto-wins are off, but the hand still plays and can still end some
    // other way — this isn't a rule that got globally disabled, just this
    // one specific early-exit path.
    expect(table.state.phase).toBe("claim-window");
  });

  it("defaults to enabled when unspecified", () => {
    const table = new Table(config(), seats(2));
    const deck = buildDeck([PELADIA_HAND, NORMAL_HAND], c("4", "diamonds"));
    table.startHand(0, deck);
    expect(table.state.handOutcome?.reason).toBe("peladia");
  });
});

describe("Table — the opening ritual reveals one stock card at a time (never two to choose between)", () => {
  it("has the same first-turn player reveal cards one at a time when the initial flip goes unclaimed", () => {
    const table = new Table(config(), seats(2));
    const deck = buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds"));
    table.startHand(0, deck);
    resolveCambio(table, ["p0", "p1"]);

    const initialCard = table.state.claim!.card;
    expect(table.state.claim).toMatchObject({
      isInitialFlip: true,
      referenceSeatIndex: 0,
      fallbackSeatIndex: 1,
    });

    table.respondToClaim("p0", "pass");
    table.respondToClaim("p1", "pass");

    // Still a claim window, not a turn — exactly one new card was revealed,
    // never two at once, and nobody was asked to choose between anything.
    expect(table.state.phase).toBe("claim-window");
    expect(table.state.claim).toMatchObject({
      isInitialFlip: true,
      referenceSeatIndex: 0,
      fallbackSeatIndex: 1,
    });
    const secondCard = table.state.claim!.card;
    expect(secondCard).not.toEqual(initialCard);
    expect(table.state.discard[table.state.discard.length - 1]).toEqual(secondCard);
    // The revealed card never joined anyone's hand — it's only on offer.
    expect(table.state.hands["p0"]).toHaveLength(9);
    expect(table.state.hands["p1"]).toHaveLength(9);

    // Still nobody wants it — a third card is revealed, one at a time again.
    table.respondToClaim("p0", "pass");
    table.respondToClaim("p1", "pass");
    expect(table.state.phase).toBe("claim-window");
    const thirdCard = table.state.claim!.card;
    expect(thirdCard).not.toEqual(secondCard);
  });

  it("gives every claim window a fresh, distinct claimWindowId — even consecutive ritual reveals that never leave phase claim-window (regression: this is what let a stale server-side timeout timer, scheduled for an earlier reveal, force-close a completely different, freshly-opened window)", () => {
    const table = new Table(config(), seats(2));
    const deck = buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds"));
    table.startHand(0, deck);
    resolveCambio(table, ["p0", "p1"]);

    const firstId = table.state.claim!.claimWindowId;
    table.respondToClaim("p0", "pass");
    table.respondToClaim("p1", "pass");
    const secondId = table.state.claim!.claimWindowId;
    table.respondToClaim("p0", "pass");
    table.respondToClaim("p1", "pass");
    const thirdId = table.state.claim!.claimWindowId;

    expect(new Set([firstId, secondId, thirdId]).size).toBe(3);
    expect(secondId).toBeGreaterThan(firstId);
    expect(thirdId).toBeGreaterThan(secondId);
  });

  it("ends the ritual the instant someone claims a revealed card, starting their turn with it", () => {
    const hand0: Card[] = [c("8", "spades"), c("8", "hearts"), ...NORMAL_HAND.slice(2)];
    const table = new Table(config(), seats(2));
    const deck = buildDeck([hand0, NORMAL_HAND.slice().reverse()], c("4", "diamonds"));
    table.startHand(0, deck);
    resolveCambio(table, ["p0", "p1"]);
    // Stack the stock so the next card revealed completes p0's pair of 8s.
    table.state.stock.push(c("8", "clubs"));

    table.respondToClaim("p0", "pass");
    table.respondToClaim("p1", "pass"); // reveals the 8 of clubs next
    expect(table.state.claim!.card).toEqual(c("8", "clubs"));

    table.respondToClaim("p0", "claim");
    table.respondToClaim("p1", "pass");

    expect(table.state.phase).toBe("turn-active");
    expect(table.state.turnSeatIndex).toBe(0);
    expect(table.state.mustPlaceCard).toEqual(c("8", "clubs"));
    expect(table.state.hands["p0"]).toContainEqual(c("8", "clubs"));
  });

  it("ends the hand with no winner ('se va doble') if the stock is ever fully exhausted during the opening ritual", () => {
    const table = new Table(config(), seats(2));
    const deck = buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds"));
    table.startHand(0, deck);
    resolveCambio(table, ["p0", "p1"]);

    table.state.stock = []; // nothing left to reveal
    table.forceResolveClaimWindow();

    expect(table.state.phase).toBe("hand-over");
    expect(table.state.handOutcome).toEqual({
      reason: "stock-exhausted",
      winnerSeatIndex: null,
      winningMelds: [],
    });
  });

  it("draws exactly 1 card on a normal turn, same as always", () => {
    const table = new Table(config(), seats(2));
    const deck = buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds"));
    table.startHand(0, deck);
    resolveCambio(table, ["p0", "p1"]);
    skipToNormalTurn(table, 1);

    const drawn = table.drawFromStock("p1");
    expect(drawn).toHaveLength(1);
  });

  it("ends the hand instead of recursing forever if every seat becomes inactive mid-ritual (regression: this crashed the server with a stack overflow in production)", () => {
    // Reproduces the exact production crash: both seats disconnect (their
    // reconnect grace periods both run out around the same time) while the
    // opening ritual's claim window is still open with nobody having
    // claimed anything yet. Before the fix, resolveClaimWindow() would
    // recurse to reveal another card, find pendingSeatIndices empty again
    // (nobody left to offer it to), and recurse again — forever, since
    // each reveal also feeds the discard pile, which keeps getting
    // recycled back into the stock, so "stock hits 0" never becomes a real
    // exit condition on its own.
    const table = new Table(config(), seats(2));
    const deck = buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds"));
    table.startHand(0, deck);
    resolveCambio(table, ["p0", "p1"]);
    expect(table.state.phase).toBe("claim-window");
    expect(table.state.claim?.isInitialFlip).toBe(true);

    // Both seats disconnect and their grace periods elapse without either
    // reconnecting — handleDisconnect is exactly what the transport layer
    // calls once that timer fires (see index.ts).
    expect(() => {
      table.handleDisconnect("p0");
      table.handleDisconnect("p1");
    }).not.toThrow();

    expect(table.state.phase).toBe("hand-over");
    expect(table.state.handOutcome).toEqual({
      reason: "stock-exhausted",
      winnerSeatIndex: null,
      winningMelds: [],
    });
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
    // Cambio: each seat gives away its last card (index 8) — hand2 keeps its
    // 8♥/8♦ pair (indices 0-1) intact for the claim later in this test.
    resolveCambio(table, ["p0", "p1", "p2"]);
    // Nobody wants the initial flip — jump straight to seat1 (dealer(0)+1,
    // the designated first player)'s normal turn, already having drawn.
    skipToNormalTurn(table, 1, true);
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

  it("offers a discard to every other active seat at once — not one at a time in sequence", () => {
    const table = new Table(config(), seats(3));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND, NORMAL_HAND], c("4", "diamonds")));
    resolveCambio(table, ["p0", "p1", "p2"]);
    skipToNormalTurn(table, 0, true);

    table.state.hands["p0"] = [...table.state.hands["p0"]!, c("9", "spades")];
    table.discard("p0", c("9", "spades"));

    expect(table.state.phase).toBe("claim-window");
    // Both p1 and p2 are simultaneously eligible to respond — neither has to
    // wait for the other to pass first.
    expect(table.state.claim?.pendingSeatIndices.sort()).toEqual([1, 2]);
  });

  it("resolves a simultaneous multi-claim by rotation priority, not by who responded first", () => {
    // 4 players, seat0 discards a card both seat2 and seat3 can use —
    // seat2 is closer in rotation from seat0, so it wins even if seat3
    // responds first.
    const hand2: Card[] = [c("8", "hearts"), c("8", "diamonds"), ...NORMAL_HAND.slice(2)];
    // A run, not a pair — completes 6-7-8 of spades with the discarded card.
    const hand3: Card[] = [c("6", "spades"), c("7", "spades"), ...NORMAL_HAND.slice(2)];
    const table = new Table(config(), seats(4));
    const deck = buildDeck([NORMAL_HAND, NORMAL_HAND, hand2, hand3], c("4", "diamonds"));
    table.startHand(0, deck);
    resolveCambio(table, ["p0", "p1", "p2", "p3"]);
    skipToNormalTurn(table, 0, true);

    table.state.hands["p0"] = [...table.state.hands["p0"]!, c("8", "spades")];
    table.discard("p0", c("8", "spades"));

    // p3 responds FIRST, p2 responds second — priority must still go to p2
    // (closer to the discarder), not whoever answered first.
    table.respondToClaim("p3", "claim");
    table.respondToClaim("p1", "pass");
    table.respondToClaim("p2", "claim");

    expect(table.state.phase).toBe("turn-active");
    expect(table.state.turnSeatIndex).toBe(2);
    expect(table.state.hands["p2"]).toContainEqual(c("8", "spades"));
    expect(table.state.hands["p3"]).not.toContainEqual(c("8", "spades"));
  });

  it("moves on to the next active seat, unclaimed, when nobody claims it", () => {
    const table = new Table(config(), seats(3));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND, NORMAL_HAND], c("4", "diamonds")));
    resolveCambio(table, ["p0", "p1", "p2"]);
    skipToNormalTurn(table, 0, true);

    table.state.hands["p0"] = [...table.state.hands["p0"]!, c("K", "diamonds")];
    table.discard("p0", c("K", "diamonds"));

    table.respondToClaim("p1", "pass");
    table.respondToClaim("p2", "pass");

    expect(table.state.phase).toBe("turn-active");
    expect(table.state.turnSeatIndex).toBe(1); // normal next seat after p0
    expect(table.state.hasDrawnThisTurn).toBe(false); // p1 hasn't drawn yet
    expect(table.state.discard[table.state.discard.length - 1]).toEqual(c("K", "diamonds"));
  });

  it("rejects a claim from a seat that isn't genuinely eligible, without silently passing them through", () => {
    const table = new Table(config(), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    resolveCambio(table, ["p0", "p1"]);
    skipToNormalTurn(table, 0, true);

    table.state.hands["p0"] = [...table.state.hands["p0"]!, c("K", "diamonds")];
    table.discard("p0", c("K", "diamonds"));

    // p1's hand (NORMAL_HAND reversed) has nothing that pairs with a lone
    // King of diamonds — claiming must be refused, not silently accepted.
    expect(() => table.respondToClaim("p1", "claim")).toThrow(GameError);
    // The window is still open — the rejection didn't consume their turn to respond.
    expect(table.state.phase).toBe("claim-window");
    expect(table.state.claim?.pendingSeatIndices).toContain(1);
  });

  // Re-reported live: an own run sitting at 9-10-J, holding the Q in hand as
  // a "surprise" for later, and the K gets discarded by the other player.
  // Neither the K alone extends 9-10-J (skips the Q), nor does the hand
  // alone form a new meld with it — the play only exists by claiming the K
  // and placing it together with the already-held Q. Before the
  // canUseDiscardImmediately fix, this was refused as "no te sirve de
  // inmediato" even though it's entirely legal once claimed.
  it("allows claiming a card that only becomes usable combined with a hand card on an own meld, and completing that extend", () => {
    const table = new Table(config(), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    resolveCambio(table, ["p0", "p1"]);
    skipToNormalTurn(table, 0, true);

    table.state.melds.push({
      id: "m1",
      type: "run",
      ownerId: "p1",
      cards: [c("9", "clubs"), c("10", "clubs"), c("J", "clubs")],
    });
    table.state.hands["p1"] = [c("Q", "clubs"), c("2", "spades")];

    table.state.hands["p0"] = [...table.state.hands["p0"]!, c("K", "clubs")];
    table.discard("p0", c("K", "clubs"));

    expect(table.state.phase).toBe("claim-window");
    table.respondToClaim("p1", "claim");

    expect(table.state.phase).toBe("turn-active");
    expect(table.state.turnSeatIndex).toBe(1);
    expect(table.state.mustPlaceCard).toEqual(c("K", "clubs"));

    table.extendMeld("p1", "m1", [c("K", "clubs"), c("Q", "clubs")]);

    const meld = table.state.melds.find((m) => m.id === "m1")!;
    expect(meld.cards).toEqual([
      c("9", "clubs"),
      c("10", "clubs"),
      c("J", "clubs"),
      c("K", "clubs"),
      c("Q", "clubs"),
    ]);
    expect(table.state.mustPlaceCard).toBeNull();
    expect(table.state.hands["p1"]).toEqual([c("2", "spades")]);
  });
});

describe("Table — desmoche", () => {
  it("refuses to shrink a source meld below 3 cards", () => {
    const table = new Table(config(), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    resolveCambio(table, ["p0", "p1"]);
    skipToNormalTurn(table, 1, true); // not testing the opening ritual here

    table.state.melds.push(
      { id: "m1", type: "set", ownerId: "p1", cards: [c("8", "spades"), c("8", "hearts"), c("8", "clubs")] },
      { id: "m2", type: "run", ownerId: "p1", cards: [c("5", "diamonds"), c("6", "diamonds"), c("7", "diamonds")] },
    );

    expect(() => table.desmochar("p1", "m1", "m2", c("8", "spades"))).toThrow(GameError);
  });

  it("allows moving a card out of a 4-card meld into another valid meld", () => {
    const table = new Table(config(), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    resolveCambio(table, ["p0", "p1"]);
    skipToNormalTurn(table, 1, true); // not testing the opening ritual here

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

  // Reported bug, reproduced exactly: a run 9♠-10♠-J♠-Q♠-K♠ had its 10♠
  // desmochado, leaving 9♠-J♠-Q♠-K♠ (a gap) sitting on the table as an
  // accepted "valid" meld — 4 cards, so the old length-only check let it
  // through, and a player could then win holding that gapped group.
  it("refuses to desmochar a middle card of a run even though 4 cards would remain — the gap makes it invalid", () => {
    const table = new Table(config(), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    resolveCambio(table, ["p0", "p1"]);
    skipToNormalTurn(table, 1, true);

    table.state.melds.push(
      {
        id: "m1",
        type: "run",
        ownerId: "p1",
        cards: [c("9", "spades"), c("10", "spades"), c("J", "spades"), c("Q", "spades"), c("K", "spades")],
      },
      { id: "m2", type: "set", ownerId: "p1", cards: [c("8", "hearts"), c("8", "clubs")] },
    );

    expect(() => table.desmochar("p1", "m1", "m2", c("10", "spades"))).toThrow(GameError);
    // The source meld must be left exactly as it was — never partially mutated.
    const m1 = table.state.melds.find((m) => m.id === "m1")!;
    expect(m1.cards).toHaveLength(5);
  });

  it("still allows desmocharring an END card of that same 5-card run, since the remainder stays a valid run", () => {
    const table = new Table(config(), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    resolveCambio(table, ["p0", "p1"]);
    skipToNormalTurn(table, 1, true);

    table.state.melds.push(
      {
        id: "m1",
        type: "run",
        ownerId: "p1",
        cards: [c("9", "spades"), c("10", "spades"), c("J", "spades"), c("Q", "spades"), c("K", "spades")],
      },
      { id: "m2", type: "set", ownerId: "p1", cards: [c("K", "hearts"), c("K", "clubs")] },
    );

    table.desmochar("p1", "m1", "m2", c("K", "spades"));

    const m1 = table.state.melds.find((m) => m.id === "m1")!;
    expect(m1.cards).toHaveLength(4);
    expect(m1.cards.map((card) => card.rank)).toEqual(["9", "10", "J", "Q"]);
  });
});

describe("Table — placeMeld combined with a desmoched card (regression)", () => {
  // Exact reported scenario: drew a 4♥ from the stock; already had a 4-card
  // set of 5s on the table (5♠-5♥-5♦-5♣); hand had 6♠ and 6♥. The only legal
  // play was to pull the 5♥ out of the existing set (leaving it at 3 cards,
  // still valid) and combine it with the drawn 4♥ and the hand's 6♥ into a
  // BRAND NEW run (4♥-5♥-6♥) — resolving the pending drawn card and
  // desmoching in the very same move. Before this fix, placeMeld only ever
  // pulled cards from the hand, and desmochar only ever moved a card into
  // an EXISTING meld — there was no way to do both at once, so the server
  // rejected this entirely legal play with "resuelve primero la carta que
  // robaste", even though desmoche WAS how the player intended to resolve it.
  it("lets a new meld combine the pending stock-drawn card, a hand card, AND a card desmoched from an existing own meld", () => {
    const table = new Table(config(), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    resolveCambio(table, ["p0", "p1"]);
    skipToNormalTurn(table, 1, true);

    table.state.melds.push({
      id: "m1",
      type: "set",
      ownerId: "p1",
      cards: [c("5", "spades"), c("5", "hearts"), c("5", "diamonds"), c("5", "clubs")],
    });
    // Just drew the 4♥ — already added to hand, exactly like drawFromStock does.
    table.state.hands["p1"] = [c("6", "spades"), c("6", "hearts"), c("4", "hearts")];
    table.state.pendingDrawnCard = c("4", "hearts");

    table.placeMeld("p1", [c("4", "hearts"), c("5", "hearts"), c("6", "hearts")], {
      fromMeldId: "m1",
      card: c("5", "hearts"),
    });

    const originalSet = table.state.melds.find((m) => m.id === "m1")!;
    expect(originalSet.cards).toEqual([c("5", "spades"), c("5", "diamonds"), c("5", "clubs")]);

    const newRun = table.state.melds.find((m) => m.id !== "m1")!;
    expect(newRun.type).toBe("run");
    expect(newRun.ownerId).toBe("p1");
    expect(newRun.cards).toEqual([c("4", "hearts"), c("5", "hearts"), c("6", "hearts")]);

    // The 4♥ and 6♥ left the hand (one via the meld, the other from hand);
    // the 6♠ was never part of the play and stays put, ready to discard.
    expect(table.state.hands["p1"]).toEqual([c("6", "spades")]);
    // Drawing is now fully resolved — nothing left forcing a specific card.
    expect(table.state.pendingDrawnCard).toBeNull();
    // Logged as a desmoche, same as moving into an existing meld would be.
    expect(table.state.eventLog).toContainEqual({ type: "desmocho", seatIndex: 1, card: c("5", "hearts") });
  });

  // Re-reported as a live regression after the fix above had already shipped
  // — same shape, different suit, to prove the rule isn't accidentally tied
  // to hearts specifically. Exact scenario: a complete 4-card set of 5s
  // (5♠-5♥-5♦-5♣) already down, drew a 6♣, hand had a 7♣ — desmoche the 5♣
  // out and combine it with the drawn 6♣ and hand's 7♣ into a new 5-6-7♣ run.
  it("still works for a different suit (bastos/clubs) — the exact re-reported scenario", () => {
    const table = new Table(config(), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    resolveCambio(table, ["p0", "p1"]);
    skipToNormalTurn(table, 1, true);

    table.state.melds.push({
      id: "m1",
      type: "set",
      ownerId: "p1",
      cards: [c("5", "spades"), c("5", "hearts"), c("5", "diamonds"), c("5", "clubs")],
    });
    table.state.hands["p1"] = [c("2", "spades"), c("7", "clubs"), c("6", "clubs")];
    table.state.pendingDrawnCard = c("6", "clubs");

    table.placeMeld("p1", [c("6", "clubs"), c("7", "clubs"), c("5", "clubs")], {
      fromMeldId: "m1",
      card: c("5", "clubs"),
    });

    const originalSet = table.state.melds.find((m) => m.id === "m1")!;
    expect(originalSet.cards).toEqual([c("5", "spades"), c("5", "hearts"), c("5", "diamonds")]);

    const newRun = table.state.melds.find((m) => m.id !== "m1")!;
    expect(newRun.type).toBe("run");
    expect(newRun.cards).toEqual([c("6", "clubs"), c("7", "clubs"), c("5", "clubs")]);
    expect(table.state.hands["p1"]).toEqual([c("2", "spades")]);
    expect(table.state.pendingDrawnCard).toBeNull();
  });

  // Generalizes further: a different rank (Kings, not 5s), the required
  // drawn card landing at the TOP of the run rather than the bottom, and a
  // 4-card new meld (desmoche + drawn card + 2 hand cards) instead of 3 —
  // confirms the pattern isn't narrowly tied to the one reported shape.
  it("generalizes to a different rank, a descending run, and a 4-card new meld", () => {
    const table = new Table(config(), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    resolveCambio(table, ["p0", "p1"]);
    skipToNormalTurn(table, 1, true);

    table.state.melds.push({
      id: "m1",
      type: "set",
      ownerId: "p1",
      cards: [c("K", "spades"), c("K", "hearts"), c("K", "diamonds"), c("K", "clubs")],
    });
    table.state.hands["p1"] = [c("2", "spades"), c("Q", "diamonds"), c("J", "diamonds"), c("10", "diamonds")];
    table.state.pendingDrawnCard = c("10", "diamonds");

    table.placeMeld(
      "p1",
      [c("10", "diamonds"), c("J", "diamonds"), c("Q", "diamonds"), c("K", "diamonds")],
      { fromMeldId: "m1", card: c("K", "diamonds") },
    );

    const originalSet = table.state.melds.find((m) => m.id === "m1")!;
    expect(originalSet.cards).toEqual([c("K", "spades"), c("K", "hearts"), c("K", "clubs")]);

    const newRun = table.state.melds.find((m) => m.id !== "m1")!;
    expect(newRun.type).toBe("run");
    expect(newRun.cards).toEqual([c("10", "diamonds"), c("J", "diamonds"), c("Q", "diamonds"), c("K", "diamonds")]);
    expect(table.state.hands["p1"]).toEqual([c("2", "spades")]);
    expect(table.state.pendingDrawnCard).toBeNull();
  });

  it("still refuses the desmoche source if it would shrink below 3 cards, even when combined into a new meld", () => {
    const table = new Table(config(), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    resolveCambio(table, ["p0", "p1"]);
    skipToNormalTurn(table, 1, true);

    table.state.melds.push({
      id: "m1",
      type: "set",
      ownerId: "p1",
      cards: [c("5", "spades"), c("5", "hearts"), c("5", "diamonds")],
    });
    table.state.hands["p1"] = [c("6", "spades"), c("6", "hearts"), c("4", "hearts")];
    table.state.pendingDrawnCard = c("4", "hearts");

    expect(() =>
      table.placeMeld("p1", [c("4", "hearts"), c("5", "hearts"), c("6", "hearts")], {
        fromMeldId: "m1",
        card: c("5", "hearts"),
      }),
    ).toThrow(GameError);
  });
});

describe("Table — meld-out win and settlement", () => {
  it("ends the hand the instant the hand is emptied, without a discard", () => {
    const table = new Table(config({ ante: 100 }), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    resolveCambio(table, ["p0", "p1"]);
    skipToNormalTurn(table, 1, true); // hand gets fully overwritten below anyway

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
      // p0 never placed a single meld this hand: Mico abajo (100) + Patona (100).
      extraPerLoser: { p0: 200 },
      patonaLoserIds: ["p0"],
    });

    // p1 collects the 200 pot (their own 100 ante was already part of it,
    // so net +100) plus the 200 in Mico+Patona extras p0 owes directly =
    // net +300. p0 loses their 100 ante plus the 200 they owe = net -300.
    // Zero-sum, as it should be.
    expect(table.state.chipBalances).toEqual({ p0: -300, p1: 300 });
  });

  it("accumulates chip balances across multiple hands in the same table session", () => {
    const table = new Table(config({ ante: 100 }), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    resolveCambio(table, ["p0", "p1"]);
    skipToNormalTurn(table, 1, true);
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
    table.settleHand();
    expect(table.state.chipBalances).toEqual({ p0: -300, p1: 300 });

    // Second hand, same table, same running balances — this time p0 wins a
    // plain hand with no bonuses: ranks shifted off A-2-3/Q-K-A so no Mico
    // triggers, and p1 gets a meld on the table (even though they don't
    // win) so Patona doesn't apply to them either.
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    resolveCambio(table, ["p0", "p1"]);
    skipToNormalTurn(table, 0, true);
    table.state.melds.push({
      id: "m0",
      type: "set",
      ownerId: "p1",
      cards: [c("8", "spades"), c("8", "hearts"), c("8", "diamonds")],
    });
    table.state.hands["p0"] = [
      c("2", "spades"),
      c("3", "spades"),
      c("4", "spades"),
      c("5", "diamonds"),
      c("6", "diamonds"),
      c("7", "diamonds"),
      c("9", "clubs"),
      c("10", "clubs"),
      c("J", "clubs"),
    ];
    table.placeMeld("p0", [c("2", "spades"), c("3", "spades"), c("4", "spades")]);
    table.placeMeld("p0", [c("5", "diamonds"), c("6", "diamonds"), c("7", "diamonds")]);
    table.placeMeld("p0", [c("9", "clubs"), c("10", "clubs"), c("J", "clubs")]);
    table.settleHand();

    // p0: -300 (hand 1) + 200 pot - 100 own ante (hand 2, no bonuses) = -200.
    // p1: +300 (hand 1) - 100 ante (hand 2) = +200.
    expect(table.state.chipBalances).toEqual({ p0: -200, p1: 200 });
  });
});

describe("Table — Cambio", () => {
  it("stays in the cambio phase, hand short by one, until every seat has submitted", () => {
    const table = new Table(config(), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));

    expect(table.state.phase).toBe("cambio");
    table.submitCambioCard("p0", NORMAL_HAND[8]!);
    expect(table.state.phase).toBe("cambio");
    expect(table.state.hands["p0"]).toHaveLength(8);
    expect(table.state.hands["p1"]).toHaveLength(9);
  });

  it("rejects submitting a second card", () => {
    const table = new Table(config(), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    table.submitCambioCard("p0", NORMAL_HAND[8]!);
    expect(() => table.submitCambioCard("p0", NORMAL_HAND[7]!)).toThrow(GameError);
  });

  it("rejects handing over a card not in hand", () => {
    const table = new Table(config(), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    expect(() => table.submitCambioCard("p0", c("K", "clubs"))).toThrow(GameError);
  });

  it("swaps one card each between 2 players once both submit", () => {
    const table = new Table(config(), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));

    const p0Gives = NORMAL_HAND[8]!; // A♣
    const p1Gives = NORMAL_HAND[0]!; // 5♠ (first card of p1's reversed hand)
    table.submitCambioCard("p0", p0Gives);
    table.submitCambioCard("p1", p1Gives);

    expect(table.state.phase).toBe("claim-window"); // resolved straight into the initial claim window
    expect(table.state.hands["p0"]).toHaveLength(9);
    expect(table.state.hands["p1"]).toHaveLength(9);
    expect(table.state.hands["p0"]!.some((card) => cardId(card) === cardId(p1Gives))).toBe(true);
    expect(table.state.hands["p0"]!.some((card) => cardId(card) === cardId(p0Gives))).toBe(false);
    expect(table.state.hands["p1"]!.some((card) => cardId(card) === cardId(p0Gives))).toBe(true);
    expect(table.state.hands["p1"]!.some((card) => cardId(card) === cardId(p1Gives))).toBe(false);
  });

  it("rotates one card per seat forward (A→B→C→A) with 3 players", () => {
    const handA: Card[] = [
      c("2", "spades"), c("3", "spades"), c("4", "spades"),
      c("9", "clubs"), c("K", "diamonds"), c("6", "hearts"),
      c("J", "clubs"), c("3", "diamonds"), c("A", "hearts"),
    ];
    const handB: Card[] = [
      c("5", "spades"), c("6", "spades"), c("9", "hearts"),
      c("K", "clubs"), c("2", "hearts"), c("7", "hearts"),
      c("J", "hearts"), c("3", "hearts"), c("A", "clubs"),
    ];
    const handC: Card[] = [
      c("8", "hearts"), c("8", "diamonds"), c("9", "diamonds"),
      c("Q", "clubs"), c("2", "clubs"), c("7", "clubs"),
      c("J", "diamonds"), c("4", "hearts"), c("5", "hearts"),
    ];
    const table = new Table(config(), seats(3));
    table.startHand(0, buildDeck([handA, handB, handC], c("4", "diamonds")));

    const aGives = handA[8]!; // A♥ -> seat1 (B)
    const bGives = handB[8]!; // A♣ -> seat2 (C)
    const cGives = handC[8]!; // 5♥ -> seat0 (A)
    table.submitCambioCard("p0", aGives);
    table.submitCambioCard("p1", bGives);
    table.submitCambioCard("p2", cGives);

    expect(table.state.phase).toBe("claim-window");
    const hasCard = (playerId: string, card: Card) =>
      table.state.hands[playerId]!.some((c2) => cardId(c2) === cardId(card));

    expect(hasCard("p1", aGives)).toBe(true); // A (seat0) -> B (seat1)
    expect(hasCard("p2", bGives)).toBe(true); // B (seat1) -> C (seat2)
    expect(hasCard("p0", cGives)).toBe(true); // C (seat2) -> A (seat0)
    expect(hasCard("p0", aGives)).toBe(false);
    expect(hasCard("p1", bGives)).toBe(false);
    expect(hasCard("p2", cGives)).toBe(false);
  });
});

describe("Table — Patona", () => {
  function forceHandOver(
    table: Table,
    reason: "meld-out" | "discard-out" | "peladia" | "cuatro-cuerpos",
    winnerSeatIndex: number,
  ) {
    (table.state as { phase: string }).phase = "hand-over";
    table.state.handOutcome = { reason, winnerSeatIndex, winningMelds: [] };
  }

  it("charges Patona to every loser who placed zero melds", () => {
    const table = new Table(config({ ante: 100 }), seats(3));
    table.startHand(
      0,
      buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse(), NORMAL_HAND], c("4", "diamonds")),
    );
    // Only p1 has a meld down; p0 and p2 never placed anything.
    table.state.melds.push({
      id: "m1",
      type: "set",
      ownerId: "p1",
      cards: [c("8", "spades"), c("8", "hearts"), c("8", "clubs")],
    });
    forceHandOver(table, "meld-out", 1);

    const outcome = table.settleHand();
    if (outcome.kind !== "chips" && outcome.kind !== "money") throw new Error("expected a chips/money outcome");
    expect(outcome.extraPerLoser).toEqual({ p0: 100, p2: 100 });
  });

  it("does not charge Patona to a loser who placed at least one meld", () => {
    const table = new Table(config({ ante: 100 }), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    table.state.melds.push({
      id: "m1",
      type: "set",
      ownerId: "p0",
      cards: [c("8", "spades"), c("8", "hearts"), c("8", "clubs")],
    });
    forceHandOver(table, "meld-out", 1);

    const outcome = table.settleHand();
    if (outcome.kind !== "chips" && outcome.kind !== "money") throw new Error("expected a chips/money outcome");
    expect(outcome.extraPerLoser).toEqual({ p0: 0 });
  });

  it("never applies to a Peladía/Cuatro Cuerpos auto-win — nobody had a turn to meld", () => {
    const table = new Table(config({ ante: 100 }), seats(2));
    table.startHand(0, buildDeck([PELADIA_HAND, NORMAL_HAND], c("4", "diamonds")));

    const outcome = table.settleHand();
    if (outcome.kind !== "chips" && outcome.kind !== "money") throw new Error("expected a chips/money outcome");
    expect(outcome.extraPerLoser).toEqual({ p1: 0 });
  });
});

describe("Table — the discard pile is NEVER recycled back into the stock (regression)", () => {
  // A live report described a hand that "kept going indefinitely with bots"
  // instead of ending — traced to the stock being reshuffled from the
  // discard pile every time it hit 0, which is NOT how Desmoche works: the
  // hand must end the instant the stock alone is empty, no matter how many
  // cards are still sitting in the discard pile.

  it("ends the hand immediately when a normal draw hits an empty stock, even with many cards still in the discard pile — never reshuffles them back in", () => {
    const table = new Table(config(), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    resolveCambio(table, ["p0", "p1"]);
    skipToNormalTurn(table, 0);

    table.state.stock = [];
    const discardBefore: Card[] = [
      c("2", "diamonds"),
      c("3", "diamonds"),
      c("5", "diamonds"),
      c("6", "diamonds"),
      c("7", "diamonds"),
      c("9", "diamonds"),
      c("10", "diamonds"),
      c("J", "diamonds"),
      c("Q", "diamonds"),
    ];
    table.state.discard = [...discardBefore];

    const drawn = table.drawFromStock("p0");

    expect(drawn).toEqual([]);
    expect(table.state.phase).toBe("hand-over");
    expect(table.state.handOutcome).toEqual({
      reason: "stock-exhausted",
      winnerSeatIndex: null,
      winningMelds: [],
    });
    // The discard pile is untouched — no recycling happened.
    expect(table.state.stock).toHaveLength(0);
    expect(table.state.discard).toEqual(discardBefore);
  });

  it("ends the hand immediately when the opening ritual's reveal hits an empty stock, even with many cards still in the discard pile — never reshuffles them back in", () => {
    const table = new Table(config(), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    resolveCambio(table, ["p0", "p1"]);
    expect(table.state.phase).toBe("claim-window");
    expect(table.state.claim?.isInitialFlip).toBe(true);

    table.state.stock = [];
    const discardBefore = [...table.state.discard, c("2", "diamonds"), c("3", "diamonds"), c("5", "diamonds")];
    table.state.discard = discardBefore;

    // Both pass on the current reveal — the ritual tries to reveal another,
    // finds the stock empty, and must end the hand instead of reshuffling.
    table.respondToClaim("p0", "pass");
    table.respondToClaim("p1", "pass");

    expect(table.state.phase).toBe("hand-over");
    expect(table.state.handOutcome).toEqual({
      reason: "stock-exhausted",
      winnerSeatIndex: null,
      winningMelds: [],
    });
    expect(table.state.stock).toHaveLength(0);
    expect(table.state.discard).toEqual(discardBefore);
  });
});

describe('Table — "se va doble": the pot carries over when a hand ends with no winner', () => {
  function forceStockExhausted(table: Table): void {
    (table.state as { phase: string }).phase = "hand-over";
    table.state.handOutcome = { reason: "stock-exhausted", winnerSeatIndex: null, winningMelds: [] };
  }

  it("ends a mid-game turn with no winner the instant the stock is empty, regardless of what's in the discard pile", () => {
    const table = new Table(config(), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    resolveCambio(table, ["p0", "p1"]);
    skipToNormalTurn(table, 0);
    table.state.stock = [];
    table.state.discard = [c("2", "diamonds")];

    const drawn = table.drawFromStock("p0");

    expect(drawn).toEqual([]);
    expect(table.state.phase).toBe("hand-over");
    expect(table.state.handOutcome).toEqual({
      reason: "stock-exhausted",
      winnerSeatIndex: null,
      winningMelds: [],
    });
  });

  it("adds the full ante pot (not a per-player share) to accumulatedPot, and pays nobody", () => {
    const table = new Table(config({ ante: 100 }), seats(3));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND, NORMAL_HAND], c("4", "diamonds")));
    forceStockExhausted(table);

    const outcome = table.settleHand();

    expect(outcome).toEqual({ kind: "carry-over", addedToPot: 300, totalAccumulatedPot: 300 });
    expect(table.state.accumulatedPot).toBe(300);
  });

  it("stacks across consecutive no-winner hands instead of resetting", () => {
    const table = new Table(config({ ante: 100 }), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    forceStockExhausted(table);
    table.settleHand();
    expect(table.state.accumulatedPot).toBe(200);

    // A second hand in a row also ends with no winner.
    forceStockExhausted(table);
    const secondOutcome = table.settleHand();

    expect(secondOutcome).toEqual({ kind: "carry-over", addedToPot: 200, totalAccumulatedPot: 400 });
    expect(table.state.accumulatedPot).toBe(400);
  });

  it("has nothing to carry in dare mode — there's no pot to accumulate", () => {
    const table = new Table(config({ stakeType: "dare", ante: 0 }), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    forceStockExhausted(table);

    const outcome = table.settleHand();

    expect(outcome).toEqual({ kind: "carry-over", addedToPot: 0, totalAccumulatedPot: 0 });
    expect(table.state.accumulatedPot).toBe(0);
  });

  it("pays the eventual winner the full pot including everything accumulated, then resets it to 0", () => {
    const table = new Table(config({ ante: 100 }), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    // Two hands in a row went "se va doble" before this one: 200 + 200 = 400 accumulated.
    forceStockExhausted(table);
    table.settleHand();
    forceStockExhausted(table);
    table.settleHand();
    expect(table.state.accumulatedPot).toBe(400);

    // This hand actually gets won.
    (table.state as { phase: string }).phase = "hand-over";
    table.state.handOutcome = { reason: "meld-out", winnerSeatIndex: 0, winningMelds: [] };

    const outcome = table.settleHand();

    if (outcome.kind !== "chips" && outcome.kind !== "money") throw new Error("expected a chips/money outcome");
    // This hand's own ante pot (200) plus the 400 already accumulated.
    expect(outcome.potWon).toBe(600);
    expect(table.state.accumulatedPot).toBe(0);
  });

  // Reported bug: a stock-exhausted hand grew accumulatedPot without ever
  // debiting anyone's chipBalances for it — so once a later hand finally
  // paid that pot out to a winner, the table's total balance no longer
  // summed to zero (chips created from nothing). Every seat must actually
  // pay their ante on EVERY hand, no-winner ones included.
  it("never creates chips from nothing — the table's total balance sums to zero across carry-over hands and the eventual win", () => {
    const table = new Table(config({ ante: 100 }), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));

    forceStockExhausted(table);
    table.settleHand();
    // Both seats already paid their ante into the accumulating pot — nobody's up or down yet.
    expect(table.state.chipBalances).toEqual({ p0: -100, p1: -100 });

    forceStockExhausted(table);
    table.settleHand();
    expect(table.state.chipBalances).toEqual({ p0: -200, p1: -200 });

    (table.state as { phase: string }).phase = "hand-over";
    table.state.handOutcome = { reason: "meld-out", winnerSeatIndex: 0, winningMelds: [] };
    table.settleHand();

    const total = Object.values(table.state.chipBalances).reduce((sum, v) => sum + v, 0);
    expect(total).toBe(0);
  });

  it("doesn't touch chip balances at all in dare mode's carry-over — there's no ante to charge", () => {
    const table = new Table(config({ stakeType: "dare", ante: 0 }), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    forceStockExhausted(table);

    table.settleHand();

    expect(table.state.chipBalances).toEqual({ p0: 0, p1: 0 });
  });

  it("does not accumulate anything for a hand that ends normally with a winner", () => {
    const table = new Table(config({ ante: 100 }), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    (table.state as { phase: string }).phase = "hand-over";
    table.state.handOutcome = { reason: "meld-out", winnerSeatIndex: 0, winningMelds: [] };

    table.settleHand();

    expect(table.state.accumulatedPot).toBe(0);
  });

  it("survives startHand() dealing the next hand — the accumulated pot is never reset by a fresh deal", () => {
    const table = new Table(config({ ante: 100 }), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    forceStockExhausted(table);
    table.settleHand();
    expect(table.state.accumulatedPot).toBe(200);

    // Deal the next hand, same as Room.nextHand() would.
    table.startHand(1, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));

    expect(table.state.accumulatedPot).toBe(200);
  });
});

describe("Table — a stock draw is resolved immediately, never joining the original 9 (Corrección 1)", () => {
  /** Gets p0 to a normal stock draw, with a known, untouched 9-card hand. */
  function reachP0NormalDraw(): Table {
    const table = new Table(config(), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    resolveCambio(table, ["p0", "p1"]);
    skipToNormalTurn(table, 0); // the opening ritual has its own tests above
    return table;
  }

  it("a drawn card that doesn't fit anywhere goes straight to discard — the original 9 never change", () => {
    const table = reachP0NormalDraw();
    const handBeforeDraw = [...table.state.hands["p0"]!];
    expect(handBeforeDraw).toHaveLength(9);

    const drawn = table.drawFromStock("p0");
    expect(drawn).toHaveLength(1);
    expect(table.state.pendingDrawnCard).toEqual(drawn[0]);

    table.discard("p0", drawn[0]!);

    expect(table.state.hands["p0"]).toEqual(handBeforeDraw);
    expect(table.state.discard[table.state.discard.length - 1]).toEqual(drawn[0]);
    expect(table.state.pendingDrawnCard).toBeNull();
  });

  it("refuses to discard any of the original 9 while the drawn card is still unresolved", () => {
    const table = reachP0NormalDraw();
    const handBeforeDraw = [...table.state.hands["p0"]!];
    table.drawFromStock("p0");

    expect(() => table.discard("p0", handBeforeDraw[0]!)).toThrow(GameError);
  });

  it("refuses to desmochar while the drawn card is still unresolved", () => {
    const table = reachP0NormalDraw();
    table.state.melds.push(
      { id: "m1", type: "set", ownerId: "p0", cards: [c("8", "spades"), c("8", "hearts"), c("8", "clubs")] },
      { id: "m2", type: "run", ownerId: "p0", cards: [c("5", "diamonds"), c("6", "diamonds"), c("7", "diamonds")] },
    );
    table.drawFromStock("p0");

    expect(() => table.desmochar("p0", "m1", "m2", c("8", "spades"))).toThrow(GameError);
  });

  it("lets the drawn card be used directly in a new meld instead of being discarded", () => {
    const table = reachP0NormalDraw();
    // Give p0 a hand that's one card short of a set, so the draw can complete it.
    table.state.hands["p0"] = [c("8", "spades"), c("8", "hearts"), c("2", "clubs")];
    // Force the next stock draw to be the missing 8 of clubs.
    table.state.stock.push(c("8", "clubs"));

    const drawn = table.drawFromStock("p0");
    expect(drawn).toEqual([c("8", "clubs")]);

    table.placeMeld("p0", [c("8", "spades"), c("8", "hearts"), c("8", "clubs")]);

    expect(table.state.pendingDrawnCard).toBeNull();
    expect(table.state.hands["p0"]).toEqual([c("2", "clubs")]);
  });

  it("refuses to place a meld that omits the pending drawn card in favor of hand cards", () => {
    const table = reachP0NormalDraw();
    table.state.hands["p0"] = [
      c("9", "spades"),
      c("9", "hearts"),
      c("9", "clubs"),
      c("2", "diamonds"),
    ];
    table.state.stock.push(c("K", "diamonds"));
    table.drawFromStock("p0");

    expect(() =>
      table.placeMeld("p0", [c("9", "spades"), c("9", "hearts"), c("9", "clubs")]),
    ).toThrow(GameError);
  });

  it("clears pendingDrawnCard and ends the hand in the same action when the drawn card completes a meld-out win", () => {
    const table = reachP0NormalDraw();
    // Simulate p0 already having an 8s set down from an earlier turn, with
    // just 2 cards left in hand — the draw supplies the 3rd to run out.
    table.state.melds.push({
      id: "m1",
      type: "set",
      ownerId: "p0",
      cards: [c("8", "spades"), c("8", "hearts"), c("8", "clubs")],
    });
    table.state.hands["p0"] = [c("5", "diamonds"), c("6", "diamonds")];
    table.state.stock.push(c("7", "diamonds"));

    const drawn = table.drawFromStock("p0");
    expect(drawn).toEqual([c("7", "diamonds")]);
    expect(table.state.pendingDrawnCard).toEqual(c("7", "diamonds"));

    table.placeMeld("p0", [c("5", "diamonds"), c("6", "diamonds"), c("7", "diamonds")]);

    expect(table.state.pendingDrawnCard).toBeNull();
    expect(table.state.phase).toBe("hand-over");
    expect(table.state.handOutcome?.reason).toBe("meld-out");
    expect(table.state.handOutcome?.winnerSeatIndex).toBe(0);
  });
});

describe("Table — allowMeldsBeforeResolvingDraw house rule", () => {
  function reachP0NormalDrawWithHouseRule(): Table {
    const table = new Table(config({ allowMeldsBeforeResolvingDraw: true }), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    resolveCambio(table, ["p0", "p1"]);
    skipToNormalTurn(table, 0);
    return table;
  }

  it("lets a meld that omits the pending drawn card go through when the house rule is on", () => {
    const table = reachP0NormalDrawWithHouseRule();
    table.state.hands["p0"] = [c("9", "spades"), c("9", "hearts"), c("9", "clubs"), c("2", "diamonds")];
    table.state.stock.push(c("K", "diamonds"));
    const drawn = table.drawFromStock("p0");
    expect(drawn).toEqual([c("K", "diamonds")]);

    table.placeMeld("p0", [c("9", "spades"), c("9", "hearts"), c("9", "clubs")]);

    // The unrelated meld went down fine, but the K♦ is still unresolved.
    expect(table.state.melds).toContainEqual(
      expect.objectContaining({ type: "set", cards: [c("9", "spades"), c("9", "hearts"), c("9", "clubs")] }),
    );
    expect(table.state.pendingDrawnCard).toEqual(c("K", "diamonds"));
  });

  it("still refuses to discard anything other than the pending card, even with the house rule on", () => {
    const table = reachP0NormalDrawWithHouseRule();
    const handBeforeDraw = [...table.state.hands["p0"]!];
    table.drawFromStock("p0");

    expect(() => table.discard("p0", handBeforeDraw[0]!)).toThrow(GameError);
  });

  it("still lets the drawn card itself be resolved normally alongside the house rule", () => {
    const table = reachP0NormalDrawWithHouseRule();
    table.state.hands["p0"] = [c("8", "spades"), c("8", "hearts"), c("2", "clubs")];
    table.state.stock.push(c("8", "clubs"));
    table.drawFromStock("p0");

    table.placeMeld("p0", [c("8", "spades"), c("8", "hearts"), c("8", "clubs")]);

    expect(table.state.pendingDrawnCard).toBeNull();
    expect(table.state.hands["p0"]).toEqual([c("2", "clubs")]);
  });
});

describe("Table — inactive seats: disconnect mid-hand and \"Retirarme de la mano\"", () => {
  it("skips a disconnected seat's own stalled turn to the next active seat", () => {
    const table = new Table(config(), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    resolveCambio(table, ["p0", "p1"]);
    skipToNormalTurn(table, 0, true); // it's p0's turn, already drawn

    table.handleDisconnect("p0");

    expect(table.state.inactiveSeatIndices).toEqual([0]);
    expect(table.state.turnSeatIndex).toBe(1);
    expect(table.state.hasDrawnThisTurn).toBe(false);
  });

  it("markIdle excludes a connected-but-unresponsive seat the same way a disconnect does", () => {
    const table = new Table(config(), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    resolveCambio(table, ["p0", "p1"]);
    skipToNormalTurn(table, 0, true); // it's p0's turn, already drawn — and still fully connected

    table.markIdle("p0");

    expect(table.state.inactiveSeatIndices).toEqual([0]);
    expect(table.state.turnSeatIndex).toBe(1);
    expect(table.state.hasDrawnThisTurn).toBe(false);
  });

  it("removes a disconnected seat from a pending claim window without force-resolving it while others are still pending", () => {
    const table = new Table(config(), seats(3));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse(), NORMAL_HAND], c("4", "diamonds")));
    resolveCambio(table, ["p0", "p1", "p2"]);

    expect(table.state.phase).toBe("claim-window");
    expect(table.state.claim!.pendingSeatIndices).toEqual([0, 1, 2]);

    table.handleDisconnect("p1");

    expect(table.state.phase).toBe("claim-window"); // p0 and p2 still haven't responded
    expect(table.state.claim!.pendingSeatIndices).toEqual([0, 2]);
  });

  it("resolves a claim window immediately once the last pending seat becomes inactive", () => {
    const table = new Table(config(), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    resolveCambio(table, ["p0", "p1"]);
    table.respondToClaim("p0", "pass");
    expect(table.state.claim!.pendingSeatIndices).toEqual([1]);

    table.handleDisconnect("p1");

    // Nobody left pending -> the ritual reveals the next card on its own.
    expect(table.state.phase).toBe("claim-window");
    expect(table.state.claim!.isInitialFlip).toBe(true);
  });

  it("resolves Cambio immediately once the only seat who hadn't submitted becomes inactive, skipping them in the exchange", () => {
    const table = new Table(config(), seats(3));
    table.startHand(
      0,
      buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse(), NORMAL_HAND], c("4", "diamonds")),
    );
    const p0Gives = table.state.hands["p0"]!.at(-1)!;
    const p1Gives = table.state.hands["p1"]!.at(-1)!;
    table.submitCambioCard("p0", p0Gives);
    table.submitCambioCard("p1", p1Gives);
    expect(table.state.phase).toBe("cambio"); // still waiting on p2

    table.handleDisconnect("p2");

    // p2 never gets a card and never gave one — p0 and p1 swap directly,
    // skipping straight over the now-inactive seat between them.
    expect(table.state.phase).toBe("claim-window");
    const hasCard = (playerId: string, card: Card) =>
      table.state.hands[playerId]!.some((c2) => cardId(c2) === cardId(card));
    expect(hasCard("p1", p0Gives)).toBe(true);
    expect(hasCard("p0", p1Gives)).toBe(true);
    expect(table.state.hands["p2"]).toHaveLength(9); // untouched
  });

  it("cancels Cambio and hands back an already-submitted card if a disconnect leaves only one active seat", () => {
    const table = new Table(config(), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    const p0Gives = table.state.hands["p0"]!.at(-1)!;
    table.submitCambioCard("p0", p0Gives);

    table.handleDisconnect("p1");

    expect(table.state.cambio).toBeNull();
    expect(table.state.hands["p0"]).toHaveLength(9); // got their submitted card back
    expect(table.state.hands["p0"]!.some((c2) => cardId(c2) === cardId(p0Gives))).toBe(true);
    expect(table.state.phase).toBe("claim-window");
    expect(table.state.claim!.pendingSeatIndices).toEqual([0]);
    expect(table.state.claim!.fallbackSeatIndex).toBe(0); // p0 plays on alone
  });

  it("skips Cambio entirely when a hand is dealt with only one seat already connected", () => {
    const oneConnected: Seat[] = [
      { seatIndex: 0, playerId: "p0", displayName: "Ana", connected: true, ready: true },
      { seatIndex: 1, playerId: "p1", displayName: "Beto", connected: false, ready: true },
    ];
    const table = new Table(config(), oneConnected);
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));

    expect(table.state.inactiveSeatIndices).toEqual([1]);
    expect(table.state.phase).toBe("claim-window"); // never entered "cambio" at all
    expect(table.state.claim!.pendingSeatIndices).toEqual([0]);
  });

  it("lets the sole remaining active player keep playing solo and actually win the hand", () => {
    const table = new Table(config({ ante: 100 }), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    resolveCambio(table, ["p0", "p1"]);
    skipToNormalTurn(table, 0, true); // already past the opening ritual, p0's turn, already drawn
    table.handleDisconnect("p1"); // p1 leaves; doesn't touch p0's own in-progress turn

    expect(table.state.phase).toBe("turn-active");
    expect(table.state.turnSeatIndex).toBe(0);
    expect(table.state.inactiveSeatIndices).toEqual([1]);

    // Force a hand p0 can fully meld on their own turn, same as the
    // existing meld-out test does.
    table.state.hands["p0"] = [
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
    table.state.hasDrawnThisTurn = true; // pretend they already drew for this turn

    table.placeMeld("p0", [c("A", "clubs"), c("2", "clubs"), c("3", "clubs")]);
    table.placeMeld("p0", [c("5", "hearts"), c("6", "hearts"), c("7", "hearts")]);
    table.placeMeld("p0", [c("9", "diamonds"), c("10", "diamonds"), c("J", "diamonds")]);

    expect(table.state.phase).toBe("hand-over");
    expect(table.state.handOutcome).toEqual({
      reason: "meld-out",
      winnerSeatIndex: 0,
      winningMelds: expect.any(Array),
    });

    // p1 still owes their ante as a loser, even though they were disconnected the whole
    // time — plus Mico abajo (A-2-3 same suit) and Patona (placed zero melds), same
    // stacking as the equivalent non-disconnected case (Corrección 1 test above).
    const outcome = table.settleHand();
    if (outcome.kind !== "chips" && outcome.kind !== "money") throw new Error("expected a chips/money outcome");
    expect(outcome.potWon).toBe(200);
    expect(outcome.extraPerLoser).toEqual({ p1: 200 });
  });

  it("does NOT hand the solo player an automatic win — the hand can still end with no winner", () => {
    const table = new Table(config(), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    resolveCambio(table, ["p0", "p1"]);
    skipToNormalTurn(table, 0);
    table.handleDisconnect("p1");
    expect(table.state.phase).toBe("turn-active");
    expect(table.state.turnSeatIndex).toBe(0);

    table.state.stock = []; // nothing left to draw
    table.state.discard = [c("2", "diamonds")];

    table.drawFromStock("p0");

    expect(table.state.phase).toBe("hand-over");
    expect(table.state.handOutcome).toEqual({
      reason: "stock-exhausted",
      winnerSeatIndex: null,
      winningMelds: [],
    });
  });

  it("reconnecting mid-hand does NOT restore a seat's eligibility for the rest of THAT hand", () => {
    const table = new Table(config(), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    resolveCambio(table, ["p0", "p1"]);
    table.handleDisconnect("p1");
    expect(table.state.inactiveSeatIndices).toEqual([1]);

    // Simulate p1 reconnecting — only Room flips this back, Table itself
    // has no "reactivate" concept, by design.
    table.state.seats.find((s) => s.playerId === "p1")!.connected = true;

    expect(table.state.inactiveSeatIndices).toEqual([1]); // still excluded this hand
  });

  it("rebuilds inactiveSeatIndices fresh on the next hand — a reconnected seat plays normally again", () => {
    const table = new Table(config(), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    resolveCambio(table, ["p0", "p1"]);
    table.handleDisconnect("p1");
    table.state.seats.find((s) => s.playerId === "p1")!.connected = true; // reconnects before the next deal

    table.startHand(1, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));

    expect(table.state.inactiveSeatIndices).toEqual([]);
    expect(table.state.phase).toBe("cambio"); // both active again, Cambio happens normally
  });

  describe("retire()", () => {
    it("refuses to retire before a hand has started, or during Cambio", () => {
      const table = new Table(config(), seats(2));
      expect(() => table.retire("p0")).toThrow(GameError);

      table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
      expect(table.state.phase).toBe("cambio");
      expect(() => table.retire("p0")).toThrow(GameError);
    });

    it("refuses to retire twice", () => {
      const table = new Table(config(), seats(3));
      table.startHand(
        0,
        buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse(), NORMAL_HAND], c("4", "diamonds")),
      );
      resolveCambio(table, ["p0", "p1", "p2"]);

      table.retire("p1");
      expect(() => table.retire("p1")).toThrow(GameError);
    });

    it("excludes the player from the rest of the hand's claim windows and turn rotation, same as a disconnect", () => {
      const table = new Table(config(), seats(3));
      table.startHand(
        0,
        buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse(), NORMAL_HAND], c("4", "diamonds")),
      );
      resolveCambio(table, ["p0", "p1", "p2"]);
      expect(table.state.claim!.pendingSeatIndices).toEqual([0, 1, 2]);

      table.retire("p2");

      expect(table.state.inactiveSeatIndices).toEqual([2]);
      expect(table.state.claim!.pendingSeatIndices).toEqual([0, 1]);
    });

    it("skips the retiring player's own stalled turn to the next active seat", () => {
      const table = new Table(config(), seats(2));
      table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
      resolveCambio(table, ["p0", "p1"]);
      skipToNormalTurn(table, 0, true);

      table.retire("p0");

      expect(table.state.turnSeatIndex).toBe(1);
      expect(table.state.inactiveSeatIndices).toEqual([0]);
    });

    it("still owes its ante (and Patona, if they placed nothing) once someone else wins", () => {
      const table = new Table(config({ ante: 100 }), seats(2));
      table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
      resolveCambio(table, ["p0", "p1"]);
      skipToNormalTurn(table, 1, true);
      table.retire("p1"); // p1 gives up, never having placed a meld

      // p0 takes over and wins.
      table.state.turnSeatIndex = 0;
      table.state.hands["p0"] = [
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
      table.state.hasDrawnThisTurn = true;
      table.placeMeld("p0", [c("A", "clubs"), c("2", "clubs"), c("3", "clubs")]);
      table.placeMeld("p0", [c("5", "hearts"), c("6", "hearts"), c("7", "hearts")]);
      table.placeMeld("p0", [c("9", "diamonds"), c("10", "diamonds"), c("J", "diamonds")]);

      const outcome = table.settleHand();
      if (outcome.kind !== "chips" && outcome.kind !== "money") throw new Error("expected a chips/money outcome");
      // p1 retired having placed zero melds -> owes Patona; p0's winning melds also
      // include Mico abajo (A-2-3 same suit), which stacks on top.
      expect(outcome.extraPerLoser).toEqual({ p1: 200 });
      expect(outcome.potWon).toBe(200);
    });
  });

  // Reported bug: an unclaimed discard's turn hand-off used to trust a
  // fallbackSeatIndex computed back when the claim window FIRST opened —
  // if that seat went inactive sometime during the (up to 30s) window
  // itself, the turn landed on a seat nobody could ever act from, and the
  // table froze there forever.
  it("skips a seat that went inactive DURING the claim window itself, instead of freezing the turn on them", () => {
    const table = new Table(config(), seats(3));
    table.startHand(
      0,
      buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse(), NORMAL_HAND], c("4", "diamonds")),
    );
    resolveCambio(table, ["p0", "p1", "p2"]);
    // Get to a normal in-hand discard from p0, opening a fresh claim window
    // whose fallback (computed right now, while everyone's still active) is p1.
    table.respondToClaim("p1", "pass");
    table.respondToClaim("p2", "pass");
    skipToNormalTurn(table, 0, true);
    table.state.hands["p0"] = [...table.state.hands["p0"]!, c("K", "diamonds")];
    table.discard("p0", c("K", "diamonds"));
    expect(table.state.claim!.fallbackSeatIndex).toBe(1);

    // p1 disconnects mid-window — the window itself doesn't resolve yet
    // (p2 hasn't responded), but the stored fallback is now stale.
    table.handleDisconnect("p1");
    expect(table.state.phase).toBe("claim-window");

    table.respondToClaim("p2", "pass");

    // Must NOT land on the now-inactive p1 — skips straight to p2.
    expect(table.state.phase).toBe("turn-active");
    expect(table.state.turnSeatIndex).toBe(2);
  });

  it("ends the hand outright the instant the LAST active seat retires mid-turn, instead of freezing with nobody left to act", () => {
    const table = new Table(config(), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    resolveCambio(table, ["p0", "p1"]);
    skipToNormalTurn(table, 0, true);
    table.handleDisconnect("p1"); // only p0 left active
    expect(table.state.inactiveSeatIndices).toEqual([1]);

    table.retire("p0"); // now NOBODY is active

    expect(table.state.phase).toBe("hand-over");
    expect(table.state.handOutcome).toEqual({
      reason: "stock-exhausted",
      winnerSeatIndex: null,
      winningMelds: [],
    });
  });

  it("ends the hand outright if the last pending seat in a claim window disconnects and nobody else is active either", () => {
    const table = new Table(config(), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    resolveCambio(table, ["p0", "p1"]);
    table.handleDisconnect("p0"); // p0 already gone, only p1 left pending on the initial claim
    expect(table.state.claim!.pendingSeatIndices).toEqual([1]);

    table.handleDisconnect("p1"); // now nobody at all

    expect(table.state.phase).toBe("hand-over");
    expect(table.state.handOutcome?.reason).toBe("stock-exhausted");
  });

  it("never lets an inactive seat act, even if turnSeatIndex somehow still pointed at them", () => {
    const table = new Table(config(), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    resolveCambio(table, ["p0", "p1"]);
    skipToNormalTurn(table, 0);
    table.handleDisconnect("p0");
    // Force the exact broken state the bug report described: the turn
    // pointing at a seat that's already inactive.
    table.state.turnSeatIndex = 0;

    expect(() => table.drawFromStock("p0")).toThrow(GameError);
  });
});

describe("Table — event log", () => {
  it("logs a Peladía declaration", () => {
    const table = new Table(config(), seats(2));
    const deck = buildDeck([PELADIA_HAND, NORMAL_HAND], c("4", "diamonds"));
    table.startHand(0, deck);

    expect(table.state.eventLog).toEqual([{ type: "peladia", seatIndex: 0 }]);
  });

  it("logs a Cuatro Cuerpos declaration", () => {
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
    const table = new Table(config(), seats(2));
    const deck = buildDeck([cuatroA, NORMAL_HAND], c("4", "diamonds"));
    table.startHand(0, deck);

    expect(table.state.eventLog).toEqual([{ type: "cuatro-cuerpos", seatIndex: 0 }]);
  });

  it("logs who claimed a discard out of turn, and which card", () => {
    const table = new Table(config(), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    resolveCambio(table, ["p0", "p1"]);
    skipToNormalTurn(table, 0, true);

    // Give p1 a pair of 8s so the discarded 8♣ completes a set — genuinely
    // eligible to claim, not just structurally allowed to try.
    table.state.hands["p1"] = [c("8", "hearts"), c("8", "diamonds"), c("2", "clubs")];
    table.state.hands["p0"] = [...table.state.hands["p0"]!, c("8", "clubs")];
    table.discard("p0", c("8", "clubs"));
    table.respondToClaim("p1", "claim");

    expect(table.state.eventLog).toContainEqual({
      type: "claimed-discard",
      seatIndex: 1,
      card: c("8", "clubs"),
    });
  });

  it("logs a desmoche, with the card that moved", () => {
    const table = new Table(config(), seats(2));
    table.startHand(0, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    resolveCambio(table, ["p0", "p1"]);
    skipToNormalTurn(table, 1, true);

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

    expect(table.state.eventLog).toContainEqual({
      type: "desmocho",
      seatIndex: 1,
      card: c("8", "diamonds"),
    });
  });

  it("accumulates across hands instead of resetting on startHand()", () => {
    const table = new Table(config(), seats(2));
    const deck = buildDeck([PELADIA_HAND, NORMAL_HAND], c("4", "diamonds"));
    table.startHand(0, deck);
    expect(table.state.eventLog).toHaveLength(1);

    // A second hand, this time a normal deal — the Peladía entry from hand 1
    // must still be there afterward.
    table.startHand(1, buildDeck([NORMAL_HAND, NORMAL_HAND.slice().reverse()], c("4", "diamonds")));
    expect(table.state.eventLog).toHaveLength(1);
    expect(table.state.eventLog[0]).toEqual({ type: "peladia", seatIndex: 0 });
  });

  it("starts empty for a brand-new table", () => {
    const table = new Table(config(), seats(2));
    expect(table.state.eventLog).toEqual([]);
  });
});
