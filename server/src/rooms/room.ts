import type { ClientGameState, ClientHandHistoryEntry, StakeType } from "@desmoche/shared";
import { BOT_PERSONAS, isBotPlayerId } from "../game/bot";
import { toClientView } from "../game/clientView";
import { GameError } from "../game/errors";
import { Table } from "../game/table";
import type { HandOutcome } from "../game/payouts";
import type { Seat, TableConfig } from "../game/state";
import { nextSeat } from "../game/turnOrder";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // skips 0/O/1/I to avoid confusion

export function generateTableCode(length = 5): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Owns one table's lobby (players joining/readying up by code) and, once
 * everyone is ready, the live `Table` for the hand in progress. Knows
 * nothing about Socket.io — the transport layer drives it through this API
 * and broadcasts `viewFor(playerId)` to whoever needs an update.
 *
 * `playerId` is always the authenticated user's persistent id (from the JWT),
 * never a per-session token — reconnecting is just joining again with the
 * same id, which reactivates the existing seat instead of adding a new one.
 */
export class Room {
  readonly code: string;
  readonly stakeType: StakeType;
  readonly ante: number;
  /** "Modo sin automáticas": Peladía/Cuatro Cuerpos never end a hand early when false. Fixed for the table's lifetime, chosen at creation. */
  readonly autoWinsEnabled: boolean;

  private seats: Seat[] = [];
  private table: Table | null = null;
  private dealerSeatIndex = 0;
  private handSettled = false;
  private settlementCache: HandOutcome | null = null;
  /** Every hand settled so far this session — never reset across hands, only starts empty for a brand-new Room. */
  private history: ClientHandHistoryEntry[] = [];
  /** Users watching the table without a seat — never counted toward playerCount, never dealt a hand, never touch settlement. */
  private spectatorIds = new Set<string>();

  constructor(code: string, stakeType: StakeType, ante: number, autoWinsEnabled = true) {
    this.code = code;
    this.stakeType = stakeType;
    this.ante = ante;
    this.autoWinsEnabled = autoWinsEnabled;
  }

  get hasStarted(): boolean {
    return this.table !== null;
  }

  get playerCount(): number {
    return this.seats.length;
  }

  /** Joins a brand-new seat, or reactivates the caller's existing one if they were already seated. */
  join(userId: string, displayName: string): void {
    const existing = this.seats.find((s) => s.playerId === userId);
    if (existing) {
      this.setConnected(userId, true);
      return;
    }

    if (this.hasStarted) throw new GameError("La mesa ya empezó a jugar");
    if (this.seats.length >= 4) throw new GameError("La mesa ya está llena");

    this.seats.push({
      seatIndex: this.seats.length,
      playerId: userId,
      displayName,
      connected: true,
      ready: false,
    });
  }

  private requireCreator(requesterId: string, action: string): void {
    if (this.seats[0]?.playerId !== requesterId) {
      throw new GameError(`Solo quien creó la mesa puede ${action}`);
    }
  }

  /** Only the table creator (seat 0), and only before the hand has started — fills the next open seat with the next unused fixed bot persona. */
  addBot(requesterId: string): void {
    if (this.hasStarted) throw new GameError("La mesa ya empezó a jugar");
    this.requireCreator(requesterId, "agregar bots");
    if (this.seats.length >= 4) throw new GameError("La mesa ya está llena");

    const used = new Set(this.seats.map((s) => s.playerId));
    const persona = BOT_PERSONAS.find((p) => !used.has(p.id));
    if (!persona) throw new GameError("No hay más bots disponibles");

    this.seats.push({
      seatIndex: this.seats.length,
      playerId: persona.id,
      displayName: persona.displayName,
      connected: true,
      // Bots have no "listo" UI of their own — they're always ready, so the
      // table only ever waits on the humans still seated.
      ready: true,
    });
  }

  /** Only the table creator, and only before the hand has started — re-indexes remaining seats so seatIndex stays contiguous. */
  removeBot(requesterId: string, botPlayerId: string): void {
    if (this.hasStarted) throw new GameError("La mesa ya empezó a jugar");
    this.requireCreator(requesterId, "quitar bots");
    if (!isBotPlayerId(botPlayerId)) throw new GameError("Ese jugador no es un bot");

    const index = this.seats.findIndex((s) => s.playerId === botPlayerId);
    if (index === -1) throw new GameError("Ese bot no está en la mesa");
    this.seats.splice(index, 1);
    this.seats.forEach((seat, i) => {
      seat.seatIndex = i;
    });
  }

  /**
   * Flips the `connected` flag only — does NOT exclude the seat from the
   * current hand. A disconnect that resolves quickly (a page refresh, a
   * brief network drop) should never cost a mid-hand player their turn; see
   * `excludeFromCurrentHandIfStillDisconnected`, which the transport layer
   * calls after a grace period, for the part that actually does that.
   */
  setConnected(playerId: string, connected: boolean): void {
    const seat = this.seats.find((s) => s.playerId === playerId);
    if (seat) seat.connected = connected;
    const tableSeat = this.table?.state.seats.find((s) => s.playerId === playerId);
    if (tableSeat) tableSeat.connected = connected;

    // A spectator has no seat to flag — just stop tracking them so the set
    // doesn't grow forever with people who've long since left.
    if (!connected) this.spectatorIds.delete(playerId);
  }

  /**
   * Excludes a seat from the REST of the current hand's turn rotation,
   * claim windows, and Cambio — called by the transport layer once a
   * reconnect grace period (see index.ts, DISCONNECT_GRACE_MS) has elapsed
   * with no reconnection. A no-op if they reconnected (setConnected(true))
   * at any point before this fires — `join()` flips `seat.connected` back
   * to true immediately, so this check alone is enough, no timer
   * cancellation bookkeeping required.
   */
  excludeFromCurrentHandIfStillDisconnected(playerId: string): void {
    const seat = this.seats.find((s) => s.playerId === playerId);
    if (!seat || seat.connected) return;
    this.table?.handleDisconnect(playerId);
  }

  /** Watch a table already in progress, without taking a seat — every hand stays hidden to them exactly like an opponent's does. A no-op for someone who's already seated; they already see everything relevant. */
  spectate(userId: string): void {
    if (!this.hasStarted) throw new GameError("La mesa todavía no empezó a jugar");
    if (this.seats.some((s) => s.playerId === userId)) return;
    this.spectatorIds.add(userId);
  }

  allSpectatorIds(): string[] {
    return [...this.spectatorIds];
  }

  setReady(playerId: string, ready: boolean): void {
    if (this.hasStarted) return;
    const seat = this.seats.find((s) => s.playerId === playerId);
    if (!seat) throw new GameError("Jugador no está en esta mesa");
    seat.ready = ready;

    if (ready && this.seats.length >= 2 && this.seats.every((s) => s.ready)) {
      this.startGame();
    }
  }

  private startGame(): void {
    const config: TableConfig = {
      code: this.code,
      stakeType: this.stakeType,
      ante: this.ante,
      autoWinsEnabled: this.autoWinsEnabled,
    };
    this.dealerSeatIndex = 0;
    this.handSettled = false;
    this.settlementCache = null;
    this.table = new Table(
      config,
      this.seats.map((s) => ({ ...s })),
    );
    this.table.startHand(this.dealerSeatIndex);
  }

  nextHand(): void {
    const table = this.requireTable();
    if (table.state.phase !== "hand-over") {
      throw new GameError("La mano en curso todavía no terminó");
    }
    this.dealerSeatIndex = nextSeat(this.dealerSeatIndex, this.seats.length);
    this.handSettled = false;
    this.settlementCache = null;
    table.startHand(this.dealerSeatIndex);
  }

  requireTable(): Table {
    if (!this.table) throw new GameError("La mesa todavía no ha empezado a jugar");
    return this.table;
  }

  /** Computes and caches the settlement as soon as a hand ends, so every view can show it — idempotent. */
  private ensureSettlementComputed(): void {
    if (this.settlementCache || !this.table || this.table.state.phase !== "hand-over") return;
    this.settlementCache = this.table.settleHand();
    const outcome = this.table.state.handOutcome;
    if (outcome) {
      this.history.push({
        reason: outcome.reason,
        winnerSeatIndex: outcome.winnerSeatIndex,
        settlement: this.settlementCache,
        playedAt: Date.now(),
      });
    }
  }

  /**
   * Returns the settlement the FIRST time it's called after a hand ends, and
   * null on every later call for that same hand — lets the transport layer
   * persist each hand's outcome exactly once without tracking its own flags.
   */
  maybeSettle(): HandOutcome | null {
    this.ensureSettlementComputed();
    if (!this.settlementCache || this.handSettled) return null;
    this.handSettled = true;
    return this.settlementCache;
  }

  allPlayerIds(): string[] {
    return this.seats.map((s) => s.playerId);
  }

  viewFor(playerId: string): ClientGameState {
    this.ensureSettlementComputed();

    if (this.table) {
      return {
        ...toClientView(
          this.table.state,
          { code: this.code, stakeType: this.stakeType, ante: this.ante, autoWinsEnabled: this.autoWinsEnabled },
          playerId,
        ),
        handSettlement: this.settlementCache,
        handHistory: this.history,
        isSpectator: this.spectatorIds.has(playerId),
      };
    }

    return {
      code: this.code,
      stakeType: this.stakeType,
      ante: this.ante,
      autoWinsEnabled: this.autoWinsEnabled,
      phase: "lobby",
      seats: this.seats.map((s) => ({
        seatIndex: s.seatIndex,
        playerId: s.playerId,
        displayName: s.displayName,
        connected: s.connected,
        ready: s.ready,
        cardCount: 0,
        inactiveThisHand: false,
        isBot: isBotPlayerId(s.playerId),
      })),
      yourSeatIndex: this.seats.find((s) => s.playerId === playerId)?.seatIndex ?? null,
      // Spectating requires the game to already be in progress — this
      // branch only runs pre-game, so it's never true here.
      isSpectator: false,
      yourHand: [],
      melds: [],
      stockCount: 0,
      topDiscard: null,
      dealerSeatIndex: 0,
      // No turn exists yet — phase is 'lobby', clients must gate on that
      // rather than treat this as a real seat index.
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
      handHistory: this.history,
      eventLog: [],
    };
  }
}
