import { cardId, type Card, type Meld } from "@desmoche/shared";
import { checkAutoWins, closestToDealerRight } from "./autoWins";
import { calculateBonuses } from "./bonuses";
import { buildShuffledDeck, deal, shuffle, type Rng } from "./deck";
import { canDesmocharFrom, canUseDiscardImmediately, isHandEmptied } from "./meldActions";
import { isValidMeld, isValidSet } from "./melds";
import { GameError } from "./errors";
import { firstTurnStockDrawCount } from "./firstTurn";
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
      firstTurnChoice: null,
      cambio: null,
      claim: null,
      isFirstTurn: true,
      handOutcome: null,
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

  private finishHand(
    reason: HandOutcomeSummary["reason"],
    winnerSeatIndex: number,
    winningMelds: Meld[],
  ): void {
    this.state.phase = "hand-over";
    this.state.handOutcome = { reason, winnerSeatIndex, winningMelds };
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
    this.state.isFirstTurn = true;
    this.state.hasDrawnThisTurn = false;
    this.state.mustPlaceCard = null;
    this.state.pendingDrawnCard = null;
    this.state.firstTurnChoice = null;
    this.state.cambio = null;
    this.state.handOutcome = null;

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
      this.finishHand("cuatro-cuerpos", winnerSeat, []);
      return;
    }
    if (autoWins.peladiaSeatIndices.length > 0) {
      const winnerSeat = closestToDealerRight(dealerSeatIndex, autoWins.peladiaSeatIndices, n);
      this.finishHand("peladia", winnerSeat, []);
      return;
    }

    // Peladía/Cuatro Cuerpos are checked on the as-dealt hand — Cambio only
    // happens once neither auto-win applies (see startHand's early returns
    // above), matching the brief's "se declaran apenas se reparte".
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
    if (cambio.submitted[playerId]) {
      throw new GameError("Ya entregaste tu carta de Cambio");
    }
    this.state.hands[playerId] = removeCard(handOf(this.state, playerId), card);
    cambio.submitted[playerId] = card;

    const allSubmitted = this.state.seats.every((s) => cambio.submitted[s.playerId]);
    if (allSubmitted) {
      this.resolveCambio();
    }
  }

  private resolveCambio(): void {
    const cambio = this.state.cambio;
    if (!cambio) return;
    const n = this.playerCount;

    for (const seat of this.state.seats) {
      const givenCard = cambio.submitted[seat.playerId]!;
      const recipientId = this.seatPlayerId(nextSeat(seat.seatIndex, n));
      this.state.hands[recipientId] = [...handOf(this.state, recipientId), givenCard];
    }
    this.state.cambio = null;
    this.openInitialClaimWindow();
  }

  private openInitialClaimWindow(): void {
    const n = this.playerCount;
    const firstTurnSeatIndex = nextSeat(this.state.dealerSeatIndex, n);
    const initialCard = this.state.discard[this.state.discard.length - 1]!;
    this.state.phase = "claim-window";
    this.state.claim = {
      card: initialCard,
      referenceSeatIndex: this.state.dealerSeatIndex,
      pendingSeatIndices: this.state.seats.map((s) => s.seatIndex),
      claimedBy: [],
      fallbackSeatIndex: firstTurnSeatIndex,
      isInitialFlip: true,
    };
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
      this.state.discard.pop();
      this.state.hands[winnerId] = [...handOf(this.state, winnerId), claim.card];
      this.state.turnSeatIndex = winnerSeat;
      this.state.hasDrawnThisTurn = true;
      this.state.mustPlaceCard = claim.card;
      this.state.isFirstTurn = false;
      this.state.phase = "turn-active";
      this.state.claim = null;
      return;
    }

    this.state.turnSeatIndex = claim.fallbackSeatIndex;
    this.state.hasDrawnThisTurn = false;
    this.state.mustPlaceCard = null;
    this.state.phase = "turn-active";
    this.state.claim = null;
    // isFirstTurn stays true only if this WAS the initial flip going unclaimed;
    // drawFromStock() checks it to grant the compensating 2-card draw.
    if (!claim.isInitialFlip) {
      this.state.isFirstTurn = false;
    }
  }

  private reshuffleStockIfNeeded(cardsNeeded: number): void {
    if (this.state.stock.length >= cardsNeeded) return;
    const top = this.state.discard[this.state.discard.length - 1];
    const rest = this.state.discard.slice(0, -1);
    this.state.stock = [...this.state.stock, ...shuffle(rest, this.rng)];
    this.state.discard = top ? [top] : [];
  }

  drawFromStock(playerId: string): Card[] {
    this.requireSeatTurn(playerId);
    if (this.state.phase !== "turn-active" || this.state.hasDrawnThisTurn) {
      throw new GameError("Ya robaste esta ronda, o no es momento de robar");
    }

    const count = this.state.isFirstTurn ? firstTurnStockDrawCount(false) : 1;
    this.reshuffleStockIfNeeded(count);
    const drawn = this.state.stock.slice(-count);
    this.state.stock = this.state.stock.slice(0, -count);
    this.state.hands[playerId] = [...handOf(this.state, playerId), ...drawn];

    if (count === 2) {
      this.state.firstTurnChoice = [drawn[0]!, drawn[1]!];
      this.state.phase = "first-turn-choice";
      return drawn;
    }

    this.state.hasDrawnThisTurn = true;
    this.state.mustPlaceCard = null;
    // The stock draw never joins the "original 9" for a free discard choice —
    // it must be used in a meld or discarded outright before anything else.
    this.state.pendingDrawnCard = drawn[0]!;
    this.state.isFirstTurn = false;
    return drawn;
  }

  /** Resolves the first-turn double draw: keep one card, the other is burned to the discard. */
  chooseFirstTurnCard(playerId: string, keepCard: Card): void {
    this.requireSeatTurn(playerId);
    const choice = this.state.firstTurnChoice;
    if (this.state.phase !== "first-turn-choice" || !choice) {
      throw new GameError("No hay una elección de robo doble pendiente");
    }
    const [a, b] = choice;
    const keep = [a, b].find((c) => cardId(c) === cardId(keepCard));
    if (!keep) throw new GameError("Debes elegir una de las dos cartas robadas");
    const reject = cardId(a) === cardId(keep) ? b : a;

    this.state.hands[playerId] = removeCard(handOf(this.state, playerId), reject);
    this.state.discard.push(reject);
    this.state.firstTurnChoice = null;
    this.state.hasDrawnThisTurn = true;
    this.state.mustPlaceCard = null;
    // The card kept from the special double draw is still a stock draw at
    // heart — same immediate-resolution rule applies to it.
    this.state.pendingDrawnCard = keep;
    this.state.isFirstTurn = false;
    this.state.phase = "turn-active";
  }

  private assertCanAct(playerId: string): void {
    this.requireSeatTurn(playerId);
    if (this.state.phase !== "turn-active" || !this.state.hasDrawnThisTurn) {
      throw new GameError("Debes robar antes de jugar");
    }
    if (this.state.firstTurnChoice) {
      throw new GameError("Primero elige cuál de las dos cartas robadas conservas");
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

  /** Places a brand-new meld built entirely from the player's hand. */
  placeMeld(playerId: string, cards: Card[]): void {
    this.assertCanAct(playerId);
    this.assertPendingDrawnCardIncluded(cards);
    if (!isValidMeld(cards)) {
      throw new GameError("Ese grupo no es válido");
    }
    let hand = handOf(this.state, playerId);
    for (const card of cards) hand = removeCard(hand, card);
    this.state.hands[playerId] = hand;

    const meldType = isValidSet(cards) ? "set" : "run";
    this.state.melds.push({ id: newMeldId(), type: meldType, ownerId: playerId, cards });

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
      card,
      referenceSeatIndex: seat.seatIndex,
      pendingSeatIndices: this.state.seats
        .map((s) => s.seatIndex)
        .filter((s) => s !== seat.seatIndex),
      claimedBy: [],
      fallbackSeatIndex: nextSeat(seat.seatIndex, this.playerCount),
      isInitialFlip: false,
    };
  }

  /** Combines the auto-win/meld-out outcome with Mico bonuses into a payout. */
  settleHand(): HandOutcome {
    const outcome = this.state.handOutcome;
    if (!outcome) throw new GameError("La mano todavía no ha terminado");
    const winnerId = this.seatPlayerId(outcome.winnerSeatIndex);
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

    return calculateHandOutcome({
      stakeType: this.config.stakeType,
      ante: this.config.ante,
      winnerId,
      loserIds,
      bonuses,
      patonaLoserIds,
    });
  }
}
