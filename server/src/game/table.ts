import {
  cardId,
  canDesmocharFrom,
  canUseDiscardImmediately,
  isHandEmptied,
  isValidMeld,
  isValidSet,
  type Card,
  type Meld,
} from "@desmoche/shared";
import { checkAutoWins, closestToDealerRight } from "./autoWins";
import { calculateBonuses } from "./bonuses";
import { buildShuffledDeck, deal, type Rng } from "./deck";
import { GameError } from "./errors";
import { resolveDiscardClaimPriority } from "./discardClaim";
import { calculateHandOutcome, type HandOutcome } from "./payouts";
import { nextSeat } from "./turnOrder";
import type { GameState, HandOutcomeSummary, Seat, TableConfig } from "./state";
import { handOf, seatOf } from "./state";

function removeCard(hand: Card[], card: Card): Card[] {
  const index = hand.findIndex((c) => cardId(c) === cardId(card));
  if (index === -1) throw new GameError("Esa carta no está en tu mano");
  return [...hand.slice(0, index), ...hand.slice(index + 1)];
}

function meldById(state: GameState, meldId: string): Meld {
  const meld = state.melds.find((m) => m.id === meldId);
  if (!meld) throw new GameError("Ese grupo no existe en la mesa");
  return meld;
}

let meldIdCounter = 0;
function newMeldId(): string {
  meldIdCounter += 1;
  return `meld-${meldIdCounter}`;
}

/**
 * Stateful orchestrator wrapping the pure rules-engine modules into one
 * table's live game state. This is the single source of truth a real-time
 * transport layer (Socket.io) should sit on top of — it never re-implements
 * rule checks itself, only calls into ./melds, ./autoWins, etc.
 *
 * Design note: every discard pickup — including the very first flipped-up
 * card — goes through the same claim-window flow. There is no separate
 * "draw from discard as the current player" action: if nobody claims a
 * discarded card during its window, the next player simply draws from stock.
 * This matches the brief's emphasis that discard priority is never
 * automatically the next player's.
 */
export class Table {
  state: GameState;
  readonly config: TableConfig;
  private readonly rng: Rng;
  /** See ClaimWindowState.claimWindowId — incremented every time a new claim window opens, never reused. */
  private nextClaimWindowId = 1;

  constructor(config: TableConfig, seats: Seat[], rng: Rng = Math.random) {
    if (seats.length < 2 || seats.length > 4) {
      throw new GameError("Desmoche se juega con 2, 3 o 4 jugadores");
    }
    this.config = config;
    this.rng = rng;
    this.state = {
      phase: "lobby",
      seats,
      hands: {},
      melds: [],
      stock: [],
      discard: [],
      dealerSeatIndex: 0,
      turnSeatIndex: nextSeat(0, seats.length),
      hasDrawnThisTurn: false,
      mustPlaceCard: null,
      pendingDrawnCard: null,
      cambio: null,
      claim: null,
      inactiveSeatIndices: [],
      accumulatedPot: 0,
      handOutcome: null,
      eventLog: [],
      chipBalances: Object.fromEntries(seats.map((s) => [s.playerId, 0])),
    };
  }

  private get playerCount(): number {
    return this.state.seats.length;
  }

  private seatPlayerId(seatIndex: number): string {
    const seat = this.state.seats.find((s) => s.seatIndex === seatIndex);
    if (!seat) throw new GameError("Asiento inválido");
    return seat.playerId;
  }

  private requireSeatTurn(playerId: string): Seat {
    const seat = seatOf(this.state, playerId);
    if (seat.seatIndex !== this.state.turnSeatIndex) {
      throw new GameError("No es tu turno");
    }
    return seat;
  }

  /**
   * Walks forward from `fromSeatIndex`, skipping any seat currently in
   * `inactiveSeatIndices`, and returns the first active seat found — wraps
   * all the way around back to `fromSeatIndex` itself if it's the only
   * active seat left (the "juega solo contra el mazo" case).
   */
  private nextActiveSeat(fromSeatIndex: number): number {
    const n = this.playerCount;
    let candidate = nextSeat(fromSeatIndex, n);
    for (let steps = 0; steps < n; steps++) {
      if (!this.state.inactiveSeatIndices.includes(candidate)) return candidate;
      candidate = nextSeat(candidate, n);
    }
    // Nobody active at all — shouldn't happen while the table exists, but
    // fall back to the plain next seat rather than looping forever.
    return nextSeat(fromSeatIndex, n);
  }

  /**
   * Excludes a seat from the REST of the current hand's turn rotation,
   * claim windows, and Cambio — used by both a mid-hand disconnect and a
   * voluntary "Retirarme de la mano". If it immediately unblocks whatever
   * the table is waiting on (the last pending Cambio submission, the last
   * pending claim response, or this seat's own stalled turn), resolves that
   * right away instead of leaving the hand stuck waiting on someone who can
   * no longer act.
   */
  private markSeatInactive(seatIndex: number): void {
    if (this.state.inactiveSeatIndices.includes(seatIndex)) return;
    if (this.state.phase === "lobby" || this.state.phase === "hand-over") return;
    this.state.inactiveSeatIndices.push(seatIndex);

    if (this.state.phase === "cambio" && this.state.cambio) {
      const cambio = this.state.cambio;
      const activeSeats = this.state.seats.filter(
        (s) => !this.state.inactiveSeatIndices.includes(s.seatIndex),
      );
      if (activeSeats.length <= 1) {
        // Nothing left to exchange — cancel Cambio, handing back whatever
        // was already submitted, and go straight to the opening ritual.
        for (const [playerId, card] of Object.entries(cambio.submitted)) {
          this.state.hands[playerId] = [...handOf(this.state, playerId), card];
        }
        this.state.cambio = null;
        this.openInitialClaimWindow();
        return;
      }
      if (activeSeats.every((s) => cambio.submitted[s.playerId])) {
        this.resolveCambio();
      }
      return;
    }

    if (this.state.phase === "claim-window" && this.state.claim) {
      this.state.claim.pendingSeatIndices = this.state.claim.pendingSeatIndices.filter(
        (s) => s !== seatIndex,
      );
      if (this.state.claim.pendingSeatIndices.length === 0) {
        this.resolveClaimWindow();
      }
      return;
    }

    if (this.state.phase === "turn-active" && this.state.turnSeatIndex === seatIndex) {
      this.state.turnSeatIndex = this.nextActiveSeat(seatIndex);
      this.state.hasDrawnThisTurn = false;
      this.state.mustPlaceCard = null;
      this.state.pendingDrawnCard = null;
    }
  }

  /**
   * Called when a seat disconnects mid-hand. Reconnecting later does NOT
   * undo this — they stay excluded from the rest of THIS hand and rejoin
   * fresh (if still connected) when the next hand is dealt.
   */
  handleDisconnect(playerId: string): void {
    const seat = this.state.seats.find((s) => s.playerId === playerId);
    if (!seat) return;
    this.markSeatInactive(seat.seatIndex);
  }

  /**
   * A player whose socket is still connected but who simply never acted on
   * their own turn within a reasonable window (stepped away, distracted,
   * closed the laptop without a clean disconnect) — same exclusion as an
   * actual disconnect, since being present at the socket level doesn't mean
   * they're actually at the table. Distinct method name from
   * handleDisconnect purely so the reason is clear wherever it's called
   * from; the effect is identical (and equally idempotent/safe to call on
   * an already-inactive seat).
   */
  markIdle(playerId: string): void {
    const seat = this.state.seats.find((s) => s.playerId === playerId);
    if (!seat) return;
    this.markSeatInactive(seat.seatIndex);
  }

  /**
   * "Retirarme de la mano": a player who knows they can't win this hand
   * steps out on their own initiative. Excluded from the rest of THIS hand
   * exactly like a disconnect — still owes their ante like any other loser
   * once the hand settles. Only allowed once the hand is past Cambio, which
   * is mandatory, blind, and simultaneous — retiring mid-Cambio wouldn't
   * mean anything yet.
   */
  retire(playerId: string): void {
    const seat = seatOf(this.state, playerId);
    if (this.state.phase === "lobby" || this.state.phase === "cambio" || this.state.phase === "hand-over") {
      throw new GameError("No puedes retirarte de la mano en este momento");
    }
    if (this.state.inactiveSeatIndices.includes(seat.seatIndex)) {
      throw new GameError("Ya estás fuera de esta mano");
    }
    this.markSeatInactive(seat.seatIndex);
  }

  private finishHand(
    reason: Exclude<HandOutcomeSummary["reason"], "stock-exhausted">,
    winnerSeatIndex: number,
    winningMelds: Meld[],
  ): void {
    this.state.phase = "hand-over";
    this.state.handOutcome = { reason, winnerSeatIndex, winningMelds };
  }

  /**
   * "Se va doble": the stock ran out with nobody completing their hand — the
   * discard pile is NEVER recycled back into the stock in Desmoche, so this
   * fires the instant the stock alone hits 0, no matter how many cards are
   * still sitting in the discard pile. Nobody wins — settleHand() grows
   * accumulatedPot instead of paying anyone, and the next hand's own ante
   * pot stacks on top of it.
   */
  private endHandWithNoWinner(): void {
    this.state.phase = "hand-over";
    this.state.handOutcome = { reason: "stock-exhausted", winnerSeatIndex: null, winningMelds: [] };
    this.state.claim = null;
  }

  /**
   * Starts (or restarts, for a new hand) dealing. Rotates the dealer across
   * hands by passing the new `dealerSeatIndex`. `deckOverride` exists purely
   * for deterministic tests — production callers never pass it.
   */
  startHand(dealerSeatIndex: number = this.state.dealerSeatIndex, deckOverride?: Card[]): void {
    const n = this.playerCount;
    const deck = deckOverride ?? buildShuffledDeck(this.rng);
    const { hands, stock, discard } = deal(deck, n);

    this.state.dealerSeatIndex = dealerSeatIndex;
    this.state.hands = {};
    hands.forEach((hand, seatIndex) => {
      this.state.hands[this.seatPlayerId(seatIndex)] = hand;
    });
    this.state.stock = stock;
    this.state.discard = discard;
    this.state.melds = [];
    this.state.hasDrawnThisTurn = false;
    this.state.mustPlaceCard = null;
    this.state.pendingDrawnCard = null;
    this.state.cambio = null;
    this.state.handOutcome = null;
    // Rebuilt fresh every hand from CURRENT connection status — a past
    // hand's disconnect or retirement never carries into a new one.
    this.state.inactiveSeatIndices = this.state.seats
      .filter((s) => !s.connected)
      .map((s) => s.seatIndex);

    // "Modo sin automáticas": Peladía/Cuatro Cuerpos are skipped entirely —
    // every hand gets played out through Cambio and normal turns.
    if (this.config.autoWinsEnabled) {
      const autoWins = checkAutoWins(hands);
      // A four-of-a-kind hand always contains a pair, so no single hand can
      // qualify for both bonuses at once. When different players qualify for
      // different auto-wins in the same deal (not covered by the traditional
      // rule), Cuatro Cuerpos takes precedence as the rarer, more specific win.
      if (autoWins.cuatroCuerposSeatIndices.length > 0) {
        const winnerSeat = closestToDealerRight(
          dealerSeatIndex,
          autoWins.cuatroCuerposSeatIndices,
          n,
        );
        this.state.eventLog.push({ type: "cuatro-cuerpos", seatIndex: winnerSeat });
        this.finishHand("cuatro-cuerpos", winnerSeat, []);
        return;
      }
      if (autoWins.peladiaSeatIndices.length > 0) {
        const winnerSeat = closestToDealerRight(dealerSeatIndex, autoWins.peladiaSeatIndices, n);
        this.state.eventLog.push({ type: "peladia", seatIndex: winnerSeat });
        this.finishHand("peladia", winnerSeat, []);
        return;
      }
    }

    // Peladía/Cuatro Cuerpos are checked on the as-dealt hand — Cambio only
    // happens once neither auto-win applies (see startHand's early returns
    // above), matching the brief's "se declaran apenas se reparte".
    const activeSeatCount = n - this.state.inactiveSeatIndices.length;
    if (activeSeatCount <= 1) {
      // Nothing to exchange with only one (or zero) active seats — skip
      // straight to the opening claim ritual.
      this.openInitialClaimWindow();
      return;
    }

    this.state.phase = "cambio";
    this.state.cambio = { submitted: {} };
  }

  /**
   * Cambio: right after dealing (and only if nobody auto-won), each player
   * blindly hands one hand card to the next seat in rotation. Nothing is
   * exchanged until everyone has submitted — this resolves simultaneously,
   * so no player's choice can be informed by another's.
   */
  submitCambioCard(playerId: string, card: Card): void {
    const cambio = this.state.cambio;
    if (this.state.phase !== "cambio" || !cambio) {
      throw new GameError("No es momento de Cambio");
    }
    const seat = seatOf(this.state, playerId);
    if (this.state.inactiveSeatIndices.includes(seat.seatIndex)) {
      throw new GameError("Ya estás fuera de esta mano");
    }
    if (cambio.submitted[playerId]) {
      throw new GameError("Ya entregaste tu carta de Cambio");
    }
    this.state.hands[playerId] = removeCard(handOf(this.state, playerId), card);
    cambio.submitted[playerId] = card;

    const allSubmitted = this.state.seats
      .filter((s) => !this.state.inactiveSeatIndices.includes(s.seatIndex))
      .every((s) => cambio.submitted[s.playerId]);
    if (allSubmitted) {
      this.resolveCambio();
    }
  }

  private resolveCambio(): void {
    const cambio = this.state.cambio;
    if (!cambio) return;

    for (const seat of this.state.seats) {
      if (this.state.inactiveSeatIndices.includes(seat.seatIndex)) continue;
      const givenCard = cambio.submitted[seat.playerId]!;
      const recipientId = this.seatPlayerId(this.nextActiveSeat(seat.seatIndex));
      this.state.hands[recipientId] = [...handOf(this.state, recipientId), givenCard];
    }
    this.state.cambio = null;
    this.openInitialClaimWindow();
  }

  private openInitialClaimWindow(): void {
    const activeSeatIndices = this.state.seats
      .map((s) => s.seatIndex)
      .filter((idx) => !this.state.inactiveSeatIndices.includes(idx));
    const firstTurnSeatIndex = this.nextActiveSeat(this.state.dealerSeatIndex);
    const initialCard = this.state.discard[this.state.discard.length - 1]!;
    this.state.phase = "claim-window";
    this.state.claim = {
      claimWindowId: this.nextClaimWindowId++,
      card: initialCard,
      referenceSeatIndex: this.state.dealerSeatIndex,
      pendingSeatIndices: activeSeatIndices,
      claimedBy: [],
      fallbackSeatIndex: firstTurnSeatIndex,
      isInitialFlip: true,
    };
    if (activeSeatIndices.length === 0) {
      // Nobody left at all to consider it — shouldn't happen while the
      // table exists, but don't leave the hand stuck waiting on nobody.
      this.resolveClaimWindow();
    }
  }

  /** A seat's response during the claim window for the current top-of-discard card. */
  respondToClaim(playerId: string, response: "claim" | "pass"): void {
    const claim = this.state.claim;
    if (this.state.phase !== "claim-window" || !claim) {
      throw new GameError("No hay ninguna carta para reclamar en este momento");
    }
    const seat = seatOf(this.state, playerId);
    if (!claim.pendingSeatIndices.includes(seat.seatIndex)) {
      throw new GameError("Ya respondiste, o no puedes reclamar esta carta");
    }

    if (response === "claim") {
      const hand = handOf(this.state, playerId);
      const ownMelds = this.state.melds.filter((m) => m.ownerId === playerId);
      if (!canUseDiscardImmediately(hand, claim.card, ownMelds)) {
        throw new GameError("Esa carta no te sirve de inmediato, no puedes reclamarla");
      }
      claim.claimedBy.push(seat.seatIndex);
    }

    claim.pendingSeatIndices = claim.pendingSeatIndices.filter((s) => s !== seat.seatIndex);

    if (claim.pendingSeatIndices.length === 0) {
      this.resolveClaimWindow();
    }
  }

  /** Forces resolution, treating anyone who hasn't responded yet as having passed. */
  forceResolveClaimWindow(): void {
    if (this.state.phase !== "claim-window" || !this.state.claim) return;
    this.state.claim.pendingSeatIndices = [];
    this.resolveClaimWindow();
  }

  private resolveClaimWindow(): void {
    const claim = this.state.claim;
    if (!claim) return;
    const n = this.playerCount;

    if (claim.claimedBy.length > 0) {
      const winnerSeat = resolveDiscardClaimPriority(claim.referenceSeatIndex, claim.claimedBy, n);
      const winnerId = this.seatPlayerId(winnerSeat);
      this.state.eventLog.push({ type: "claimed-discard", seatIndex: winnerSeat, card: claim.card });
      this.state.discard.pop();
      this.state.hands[winnerId] = [...handOf(this.state, winnerId), claim.card];
      this.state.turnSeatIndex = winnerSeat;
      this.state.hasDrawnThisTurn = true;
      this.state.mustPlaceCard = claim.card;
      this.state.phase = "turn-active";
      this.state.claim = null;
      return;
    }

    if (claim.isInitialFlip) {
      // Nobody wanted this card — it's buried on the discard pile, and the
      // same designated first-turn player reveals ONE fresh card from the
      // stock (never two at once) for everyone to consider next. This
      // repeats, one card at a time, until someone claims one or the stock
      // is fully exhausted. The discard pile is NEVER recycled back into the
      // stock — each reveal permanently consumes one stock card, so this
      // naturally and monotonically runs out on its own.
      if (this.state.stock.length === 0) {
        // Nothing left to reveal, and nobody ever claimed anything — the
        // hand can't proceed at all. "Se va doble."
        this.endHandWithNoWinner();
        return;
      }
      const activeSeatIndices = this.state.seats
        .map((s) => s.seatIndex)
        .filter((idx) => !this.state.inactiveSeatIndices.includes(idx));
      if (activeSeatIndices.length === 0) {
        // Nobody left at all to consider a revealed card (e.g. every seat
        // disconnected and their reconnect grace periods all ran out around
        // the same time) — end the hand outright instead of opening a claim
        // window nobody can respond to.
        this.endHandWithNoWinner();
        return;
      }
      const revealedCard = this.state.stock[this.state.stock.length - 1]!;
      this.state.stock = this.state.stock.slice(0, -1);
      this.state.discard.push(revealedCard);
      this.state.claim = {
        claimWindowId: this.nextClaimWindowId++,
        card: revealedCard,
        referenceSeatIndex: claim.referenceSeatIndex,
        pendingSeatIndices: activeSeatIndices,
        claimedBy: [],
        fallbackSeatIndex: claim.fallbackSeatIndex,
        isInitialFlip: true,
      };
      this.state.phase = "claim-window";
      return;
    }

    // A normal (non-initial) discard going unclaimed: turn passes onward.
    this.state.turnSeatIndex = claim.fallbackSeatIndex;
    this.state.hasDrawnThisTurn = false;
    this.state.mustPlaceCard = null;
    this.state.phase = "turn-active";
    this.state.claim = null;
  }

  drawFromStock(playerId: string): Card[] {
    this.requireSeatTurn(playerId);
    if (this.state.phase !== "turn-active" || this.state.hasDrawnThisTurn) {
      throw new GameError("Ya robaste esta ronda, o no es momento de robar");
    }

    if (this.state.stock.length === 0) {
      // "Se va doble": the stock is empty and nobody completed their hand.
      // The discard pile is NEVER recycled back into the stock in Desmoche —
      // this ends the hand immediately, regardless of how many cards are
      // still sitting in the discard pile.
      this.endHandWithNoWinner();
      return [];
    }
    const drawn = this.state.stock.slice(-1);
    this.state.stock = this.state.stock.slice(0, -1);
    this.state.hands[playerId] = [...handOf(this.state, playerId), ...drawn];

    this.state.hasDrawnThisTurn = true;
    this.state.mustPlaceCard = null;
    // The stock draw never joins the "original 9" for a free discard choice —
    // it must be used in a meld or discarded outright before anything else.
    this.state.pendingDrawnCard = drawn[0]!;
    return drawn;
  }

  private assertCanAct(playerId: string): void {
    this.requireSeatTurn(playerId);
    if (this.state.phase !== "turn-active" || !this.state.hasDrawnThisTurn) {
      throw new GameError("Debes robar antes de jugar");
    }
  }

  /** Throws unless the pending stock-drawn card (if any) is among the cards being placed. */
  private assertPendingDrawnCardIncluded(cards: Card[]): void {
    const pending = this.state.pendingDrawnCard;
    if (pending && !cards.some((c) => cardId(c) === cardId(pending))) {
      throw new GameError(
        "Debes usar la carta que acabas de robar del mazo en este grupo, o descartarla, antes de cualquier otra cosa",
      );
    }
  }

  private clearPendingDrawnCardIfSatisfied(cards: Card[]): void {
    const pending = this.state.pendingDrawnCard;
    if (pending && cards.some((c) => cardId(c) === cardId(pending))) {
      this.state.pendingDrawnCard = null;
    }
  }

  private clearMustPlaceIfSatisfied(playerId: string, placedCards: Card[]): void {
    if (!this.state.mustPlaceCard) return;
    const stillInHand = handOf(this.state, playerId).some(
      (c) => cardId(c) === cardId(this.state.mustPlaceCard!),
    );
    const satisfiedNow = placedCards.some(
      (c) => cardId(c) === cardId(this.state.mustPlaceCard!),
    );
    if (satisfiedNow || !stillInHand) {
      this.state.mustPlaceCard = null;
    }
  }

  private checkMeldOutWin(playerId: string): void {
    if (!isHandEmptied(handOf(this.state, playerId))) return;
    const seat = seatOf(this.state, playerId);
    const winningMelds = this.state.melds.filter((m) => m.ownerId === playerId);
    this.finishHand("meld-out", seat.seatIndex, winningMelds);
  }

  /**
   * Places a brand-new meld built from the player's hand — optionally
   * combined with ONE card desmoched from an existing own meld in the same
   * move (e.g. a stock-drawn card + a hand card + a card pulled from an
   * already-placed group). Without this, "resolve the drawn/claimed card"
   * and "desmoche" were two strictly sequential actions, which made a
   * genuinely legal play (build a NEW group using a desmoched card to
   * satisfy the pending card) impossible — you'd be told to resolve the
   * pending card first, but the only way to resolve it WAS the desmoche.
   */
  placeMeld(playerId: string, cards: Card[], desmoche?: { fromMeldId: string; card: Card }): void {
    this.assertCanAct(playerId);
    this.assertPendingDrawnCardIncluded(cards);

    let sourceMeld: Meld | undefined;
    if (desmoche) {
      if (!cards.some((c) => cardId(c) === cardId(desmoche.card))) {
        throw new GameError("La carta desmochada debe ser parte del grupo nuevo");
      }
      sourceMeld = meldById(this.state, desmoche.fromMeldId);
      if (sourceMeld.ownerId !== playerId) {
        throw new GameError("Solo puedes desmochar tus propios grupos");
      }
      if (!sourceMeld.cards.some((c) => cardId(c) === cardId(desmoche.card))) {
        throw new GameError("Esa carta no está en el grupo de origen");
      }
      if (!canDesmocharFrom(sourceMeld.cards)) {
        throw new GameError("Ese grupo quedaría con menos de 3 cartas");
      }
    }

    if (!isValidMeld(cards)) {
      throw new GameError("Ese grupo no es válido");
    }

    let hand = handOf(this.state, playerId);
    for (const card of cards) {
      if (desmoche && cardId(card) === cardId(desmoche.card)) continue; // comes from sourceMeld, not the hand
      hand = removeCard(hand, card);
    }
    this.state.hands[playerId] = hand;

    if (desmoche && sourceMeld) {
      sourceMeld.cards = removeCard(sourceMeld.cards, desmoche.card);
    }

    const meldType = isValidSet(cards) ? "set" : "run";
    this.state.melds.push({ id: newMeldId(), type: meldType, ownerId: playerId, cards });

    if (desmoche) {
      this.state.eventLog.push({
        type: "desmocho",
        seatIndex: seatOf(this.state, playerId).seatIndex,
        card: desmoche.card,
      });
    }

    this.clearPendingDrawnCardIfSatisfied(cards);
    this.clearMustPlaceIfSatisfied(playerId, cards);
    this.checkMeldOutWin(playerId);
  }

  /** Adds hand cards onto one of the player's own existing melds. */
  extendMeld(playerId: string, meldId: string, cards: Card[]): void {
    this.assertCanAct(playerId);
    this.assertPendingDrawnCardIncluded(cards);
    const meld = meldById(this.state, meldId);
    if (meld.ownerId !== playerId) {
      throw new GameError("Solo puedes agregar cartas a tus propios grupos");
    }
    const combined = [...meld.cards, ...cards];
    if (!isValidMeld(combined)) {
      throw new GameError("Esa carta no encaja en ese grupo");
    }
    let hand = handOf(this.state, playerId);
    for (const card of cards) hand = removeCard(hand, card);
    this.state.hands[playerId] = hand;
    meld.cards = combined;

    this.clearPendingDrawnCardIfSatisfied(cards);
    this.clearMustPlaceIfSatisfied(playerId, cards);
    this.checkMeldOutWin(playerId);
  }

  /** Desmoche: move a card between two of the player's own table melds. */
  desmochar(playerId: string, fromMeldId: string, toMeldId: string, card: Card): void {
    this.assertCanAct(playerId);
    if (this.state.pendingDrawnCard) {
      throw new GameError(
        "Debes usar o descartar la carta que acabas de robar del mazo antes de desmochar",
      );
    }
    if (fromMeldId === toMeldId) throw new GameError("Elige dos grupos distintos");
    const fromMeld = meldById(this.state, fromMeldId);
    const toMeld = meldById(this.state, toMeldId);
    if (fromMeld.ownerId !== playerId || toMeld.ownerId !== playerId) {
      throw new GameError("Solo puedes desmochar entre tus propios grupos");
    }
    if (!canDesmocharFrom(fromMeld.cards)) {
      throw new GameError("Ese grupo quedaría con menos de 3 cartas");
    }
    const remainingFrom = removeCard(fromMeld.cards, card);
    const combinedTo = [...toMeld.cards, card];
    if (!isValidMeld(combinedTo)) {
      throw new GameError("Esa carta no encaja en el grupo destino");
    }
    fromMeld.cards = remainingFrom;
    toMeld.cards = combinedTo;
    this.state.eventLog.push({ type: "desmocho", seatIndex: seatOf(this.state, playerId).seatIndex, card });
  }

  /** Ends the turn by discarding, opening a new claim window for the card. */
  discard(playerId: string, card: Card): void {
    this.assertCanAct(playerId);
    if (this.state.mustPlaceCard) {
      throw new GameError(
        "Debes usar la carta que tomaste del descarte en un grupo antes de descartar",
      );
    }
    if (this.state.pendingDrawnCard && cardId(card) !== cardId(this.state.pendingDrawnCard)) {
      throw new GameError(
        "Debes descartar la carta que acabas de robar del mazo, o usarla en un grupo — no puedes descartar otra en su lugar",
      );
    }
    const seat = seatOf(this.state, playerId);
    this.state.hands[playerId] = removeCard(handOf(this.state, playerId), card);
    this.state.discard.push(card);
    this.state.pendingDrawnCard = null;

    this.state.hasDrawnThisTurn = false;
    this.state.phase = "claim-window";
    this.state.claim = {
      claimWindowId: this.nextClaimWindowId++,
      card,
      referenceSeatIndex: seat.seatIndex,
      pendingSeatIndices: this.state.seats
        .map((s) => s.seatIndex)
        .filter((s) => s !== seat.seatIndex && !this.state.inactiveSeatIndices.includes(s)),
      claimedBy: [],
      fallbackSeatIndex: this.nextActiveSeat(seat.seatIndex),
      isInitialFlip: false,
    };
    if (this.state.claim.pendingSeatIndices.length === 0) {
      // Solo player (or everyone else inactive) — nobody around to consider
      // claiming this discard, so the window resolves immediately.
      this.resolveClaimWindow();
    }
  }

  /** Combines the auto-win/meld-out outcome with Mico bonuses into a payout — or, for "se va doble", grows the carried-over pot instead. */
  settleHand(): HandOutcome {
    const outcome = this.state.handOutcome;
    if (!outcome) throw new GameError("La mano todavía no ha terminado");

    if (outcome.reason === "stock-exhausted") {
      const addedToPot = this.config.stakeType === "dare" ? 0 : this.config.ante * this.playerCount;
      this.state.accumulatedPot += addedToPot;
      return { kind: "carry-over", addedToPot, totalAccumulatedPot: this.state.accumulatedPot };
    }

    const winnerId = this.seatPlayerId(outcome.winnerSeatIndex!);
    const loserIds = this.state.seats
      .filter((s) => s.seatIndex !== outcome.winnerSeatIndex)
      .map((s) => s.playerId);
    const bonuses = calculateBonuses(outcome.winningMelds, this.config.ante);

    // Patona: only meaningful when the hand was actually played out — an
    // auto-win (Peladía/Cuatro Cuerpos) ends before anyone gets a turn, so
    // "placed zero melds" would trivially include everyone and isn't the
    // rule's intent.
    const patonaApplies = outcome.reason === "meld-out" || outcome.reason === "discard-out";
    const patonaLoserIds = patonaApplies
      ? loserIds.filter((loserId) => !this.state.melds.some((m) => m.ownerId === loserId))
      : [];

    // Whatever accumulated from previous "se va doble" hands rides on top of
    // this hand's own ante pot, then resets — it's been paid out now.
    const carriedOverPot = this.state.accumulatedPot;
    this.state.accumulatedPot = 0;

    const payout = calculateHandOutcome({
      stakeType: this.config.stakeType,
      ante: this.config.ante,
      winnerId,
      loserIds,
      bonuses,
      patonaLoserIds,
      carriedOverPot,
    });

    if (payout.kind === "chips" || payout.kind === "money") {
      // Every seat (winner included) put one ante into the pot the winner
      // now collects — the winner's net gain is the pot minus their own
      // ante, plus whatever Mico/Patona extras losers owe them directly.
      const totalExtras = Object.values(payout.extraPerLoser).reduce((sum, v) => sum + v, 0);
      this.state.chipBalances[winnerId] = (this.state.chipBalances[winnerId] ?? 0) + payout.potWon - this.config.ante + totalExtras;
      for (const loserId of loserIds) {
        this.state.chipBalances[loserId] =
          (this.state.chipBalances[loserId] ?? 0) - this.config.ante - (payout.extraPerLoser[loserId] ?? 0);
      }
    }

    return payout;
  }
}
